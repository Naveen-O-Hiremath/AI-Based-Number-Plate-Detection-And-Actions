import { Router } from 'express';
import { db, audit } from '../db/connection.js';
import { extractPlate, normalizePlate } from '../vision/pipeline.js';
import { findNearest } from '../vision/normalize.js';
import { broadcast } from '../ws/hub.js';

const router = Router();

function touchNode(nodeId, label) {
    const existing = db.prepare('SELECT id FROM camera_nodes WHERE id = ?').get(nodeId);
    if (existing) {
        db.prepare("UPDATE camera_nodes SET last_seen_at = datetime('now') WHERE id = ?").run(nodeId);
    } else {
        db.prepare(`
            INSERT INTO camera_nodes (id, label, location, last_seen_at)
            VALUES (?, ?, ?, datetime('now'))
        `).run(nodeId, label || nodeId, 'Mobile edge node');
        audit('NODE_REGISTERED', `New camera node registered: ${nodeId}`);
    }
}

/**
 * POST /api/detect — the edge-camera ingestion endpoint.
 * Body: { image?: dataURL, plate_number?: string, camera_node_id, node_label? }
 *
 * Runs the vision pipeline, matches the registry, applies the three-case
 * business logic, writes the movement trail, and broadcasts over WebSocket.
 */
router.post('/', async (req, res) => {
    const started = Date.now();
    const { image, plate_number: manualPlate, camera_node_id = 'UNKNOWN', node_label } = req.body || {};

    if (!image && !manualPlate) {
        return res.status(400).json({ error: 'Provide either an image or a plate_number' });
    }

    touchNode(camera_node_id, node_label);

    // 1. Vision — read the plate.
    let vision;
    if (manualPlate) {
        vision = { plate_number: normalizePlate(manualPlate), confidence: 1, source: 'manual', attempts: [] };
    } else {
        try {
            vision = await extractPlate(image);
        } catch (err) {
            console.error('[detect] vision pipeline failed:', err);
            return res.status(500).json({ error: 'Vision pipeline failed', detail: err.message });
        }
    }

    const plate = vision.plate_number;

    // 2. No plate in frame — report honestly, do not fabricate a match.
    if (!plate) {
        const payload = {
            plate_found: false,
            plate_number: '',
            confidence: vision.confidence,
            vision_source: vision.source,
            camera_node_id,
            message: 'No readable number plate detected in this frame.',
            raw_text: vision.raw_text,
            elapsed_ms: Date.now() - started,
        };
        broadcast('detection', { ...payload, status: 'NO_PLATE' });
        return res.json(payload);
    }

    // 3. Match the registry.
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get(plate);
    const snapshotUrl = `/snapshots/${plate}-${Date.now()}.jpg`;

    const movementResult = db.prepare(`
        INSERT INTO movement_logs (plate_number, camera_node_id, detected_at, snapshot_url,
                                   confidence, vision_source, matched, status_at_detection)
        VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(plate, camera_node_id, snapshotUrl, vision.confidence, vision.source,
           vehicle ? 1 : 0, vehicle ? vehicle.status : 'UNREGISTERED');
    const movementLogId = Number(movementResult.lastInsertRowid);

    // Unregistered plate — log the sighting, offer near matches.
    if (!vehicle) {
        const all = db.prepare('SELECT plate_number FROM vehicles').all().map((r) => r.plate_number);
        const suggestions = findNearest(plate, all).map((s) => {
            const v = db.prepare('SELECT owner_name, status FROM vehicles WHERE plate_number = ?').get(s.plate);
            return { ...s, owner_name: v?.owner_name, status: v?.status };
        });
        audit('DETECTION_UNMATCHED', `Unregistered plate ${plate} seen at ${camera_node_id}`);

        const payload = {
            plate_found: true, matched: false, plate_number: plate,
            confidence: vision.confidence, vision_source: vision.source,
            camera_node_id, status: 'UNREGISTERED', suggestions,
            movement_log_id: movementLogId, elapsed_ms: Date.now() - started,
        };
        broadcast('detection', payload);
        return res.json(payload);
    }

    // 4. Business logic by status.
    const fines = db.prepare(
        'SELECT * FROM fines WHERE plate_number = ? ORDER BY date_issued DESC'
    ).all(plate);
    const unpaidFines = fines.filter((f) => f.paid_status === 'UNPAID');
    const totalDue = unpaidFines.reduce((sum, f) => sum + f.amount, 0);

    const payload = {
        plate_found: true,
        matched: true,
        plate_number: plate,
        confidence: vision.confidence,
        vision_source: vision.source,
        camera_node_id,
        movement_log_id: movementLogId,
        snapshot_url: snapshotUrl,
        status: vehicle.status,
        vehicle: {
            plate_number: vehicle.plate_number,
            owner_name: vehicle.owner_name,
            owner_phone: vehicle.owner_phone,
            vehicle_model: vehicle.vehicle_model,
            vehicle_color: vehicle.vehicle_color,
            registration_date: vehicle.registration_date,
            status: vehicle.status,
            status_reason: vehicle.status_reason,
        },
        fines: { total_unpaid: unpaidFines.length, amount_due: totalDue, items: fines },
        alert: null,
        elapsed_ms: 0,
    };

    if (vehicle.status === 'WANTED_CRIMINAL') {
        // Case 3 — raise a high-priority alert and broadcast it separately so
        // the dashboard can fire its audible/banner alarm.
        const message = `WANTED vehicle ${plate} (${vehicle.vehicle_model}) detected at ${camera_node_id}`;
        const alertResult = db.prepare(`
            INSERT INTO alerts (plate_number, movement_log_id, camera_node_id, severity, message, acknowledged, created_at)
            VALUES (?, ?, ?, 'CRITICAL', ?, 0, datetime('now'))
        `).run(plate, movementLogId, camera_node_id, message);

        payload.alert = {
            id: Number(alertResult.lastInsertRowid),
            severity: 'CRITICAL',
            message,
            reason: vehicle.status_reason,
        };
        audit('ALERT_CRITICAL', message);
        broadcast('critical_alert', payload);
    } else if (vehicle.status === 'SURVEILLANCE') {
        // Case 2 — movement trail already written above; note it in the audit log.
        audit('SURVEILLANCE_HIT', `Surveillance vehicle ${plate} logged at ${camera_node_id}`);
        payload.surveillance = {
            reason: vehicle.status_reason,
            trail: db.prepare(`
                SELECT camera_node_id, detected_at FROM movement_logs
                WHERE plate_number = ? ORDER BY detected_at DESC LIMIT 10
            `).all(plate),
        };
    } else {
        // Case 1 — normal vehicle: owner info + outstanding fines.
        audit('DETECTION', `Vehicle ${plate} detected at ${camera_node_id}`);
    }

    payload.elapsed_ms = Date.now() - started;
    broadcast('detection', payload);
    res.json(payload);
});

export default router;
