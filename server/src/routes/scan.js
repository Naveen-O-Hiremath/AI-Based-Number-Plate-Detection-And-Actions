import { Router } from 'express';
import QRCode from 'qrcode';
import { db } from '../db/connection.js';
import { normalizePlate, findClosestPlates } from '../ocr/plateNormalizer.js';
import { scanImageForPlates } from '../ocr/pipeline.js';
import { getLanIPs } from '../lib/https.js';

const router = Router();

const SCANNER_CAMERA_NAME = 'Live Mobile Scanner';

function ensureScannerCamera() {
    let cam = db.prepare('SELECT id FROM cameras WHERE name = ?').get(SCANNER_CAMERA_NAME);
    if (!cam) {
        const result = db.prepare(`
            INSERT INTO cameras (name, type, location, lat, lng, status)
            VALUES (?, 'mobile', 'User device (live demo)', 12.9716, 77.5946, 'online')
        `).run(SCANNER_CAMERA_NAME);
        cam = { id: Number(result.lastInsertRowid) };
    }
    return cam.id;
}

function runPolicyChecks({ plateNumber, vehicle, cameraId, detectionId }) {
    const result = { onWatchlist: null, alertCreated: false, compliance: [], emergency: null, corridorGranted: false };

    const watchlistEntry = db.prepare('SELECT * FROM watchlist WHERE plate_number = ? AND active = 1').get(plateNumber);
    if (watchlistEntry) {
        result.onWatchlist = watchlistEntry;
        db.prepare(`
            INSERT INTO alerts (detection_id, watchlist_id, plate_number, camera_id, severity, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'open', datetime('now'))
        `).run(detectionId, watchlistEntry.id, plateNumber, cameraId, watchlistEntry.severity);
        result.alertCreated = true;
    }

    if (vehicle) {
        const today = new Date();
        const checks = [
            ['insurance', vehicle.insurance_expiry],
            ['permit', vehicle.permit_expiry],
            ['puc', vehicle.puc_expiry],
        ];
        for (const [type, expiry] of checks) {
            const daysDiff = (new Date(expiry) - today) / (1000 * 60 * 60 * 24);
            if (daysDiff < 30) {
                const status = daysDiff < 0 ? 'expired' : 'expiring_soon';
                result.compliance.push({ type, expiry, status });

                const alreadyNotifiedToday = db.prepare(`
                    SELECT id FROM notifications
                    WHERE vehicle_id = ? AND type = ? AND date(sent_at) = date('now')
                `).get(vehicle.id, type);
                if (!alreadyNotifiedToday) {
                    const message = `Dear ${vehicle.owner_name}, the ${type} for vehicle ${vehicle.plate_number} ${status === 'expired' ? 'has EXPIRED' : 'expires soon'} on ${expiry}. Please renew at the earliest to avoid penalties.`;
                    db.prepare(`
                        INSERT INTO notifications (vehicle_id, type, channel, message, sent_at)
                        VALUES (?, ?, 'sms', ?, datetime('now'))
                    `).run(vehicle.id, type, message);
                }
            }
        }

        const emergencyVehicle = db.prepare('SELECT * FROM emergency_vehicles WHERE vehicle_id = ?').get(vehicle.id);
        if (emergencyVehicle) {
            result.emergency = emergencyVehicle;
            if (emergencyVehicle.on_duty) {
                const signalId = `SIG-${Math.floor(100 + Math.random() * 900)}`;
                db.prepare(`
                    INSERT INTO green_corridor_events (emergency_vehicle_id, camera_id, signal_id, granted_at)
                    VALUES (?, ?, ?, datetime('now'))
                `).run(emergencyVehicle.id, cameraId, signalId);
                result.corridorGranted = true;
                result.signalId = signalId;
            }
        }
    }

    return result;
}

// POST /api/scan/plate — the live capture endpoint.
// Accepts either a captured frame (server runs AI/OCR) or a manually
// confirmed plate string (skips OCR — used when the operator corrects a
// misread, or types a plate directly to test the pipeline).
router.post('/plate', async (req, res) => {
    const { image, manualPlate } = req.body || {};
    if (!image && !manualPlate) {
        return res.status(400).json({ error: 'Provide either a captured image or a manualPlate string' });
    }

    let rawText = manualPlate || '';
    let ocrConfidence = 1;
    let normalized;
    let otherPlates = [];

    if (manualPlate) {
        normalized = normalizePlate(rawText);
    } else {
        try {
            // Multi-pass pipeline: preprocessing variants × segmentation modes.
            // Slower than a single pass, substantially more accurate on real
            // plates (embossed, hologram-textured, dark/light schemes).
            const scan = await scanImageForPlates(image);
            rawText = scan.rawText;
            ocrConfidence = scan.confidence / 100;
            normalized = scan.plates[0] || null;
            otherPlates = scan.plates.slice(1);
        } catch (err) {
            console.error('OCR failure:', err);
            return res.status(500).json({ error: 'OCR engine failed to process the image' });
        }
        if (!normalized) {
            // A short read means the crop was plate-sized but OCR mangled a
            // character or two (insertions/drops that regexes can't repair).
            // Fuzzy-match those against the registry rather than giving up.
            const cleaned = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (cleaned.length >= 6 && cleaned.length <= 14) {
                const guess = normalizePlate(cleaned);
                const allPlates = db.prepare('SELECT plate_number FROM vehicles').all().map((r) => r.plate_number);
                const fuzzy = findClosestPlates(guess, allPlates).map((s) => {
                    const v = db.prepare('SELECT plate_number, owner_name FROM vehicles WHERE plate_number = ?').get(s.plate);
                    return { ...s, ownerName: v?.owner_name };
                });
                if (fuzzy.length > 0) {
                    return res.json({
                        plateFound: true,
                        ocrRawText: rawText,
                        ocrConfidence,
                        plateNumber: guess,
                        matched: false,
                        vehicle: null,
                        suggestions: fuzzy,
                        detectionId: null,
                        onWatchlist: null,
                        alertCreated: false,
                        compliance: [],
                        emergency: null,
                        corridorGranted: false,
                    });
                }
            }
            return res.json({
                plateFound: false,
                ocrRawText: rawText,
                ocrConfidence,
                plateNumber: '',
                matched: false,
                vehicle: null,
                suggestions: [],
                message: 'No number plate detected in this frame. Align the plate inside the guide box, fill the frame with it, and make sure it is well-lit and in focus.',
            });
        }
    }

    if (!normalized) {
        return res.json({ plateFound: false, ocrRawText: rawText, plateNumber: '', vehicle: null, matched: false, suggestions: [] });
    }

    const cameraId = ensureScannerCamera();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get(normalized);

    let suggestions = [];
    if (!vehicle) {
        const allPlates = db.prepare('SELECT plate_number FROM vehicles').all().map((r) => r.plate_number);
        suggestions = findClosestPlates(normalized, allPlates).map((s) => {
            const v = db.prepare('SELECT plate_number, owner_name FROM vehicles WHERE plate_number = ?').get(s.plate);
            return { ...s, ownerName: v?.owner_name };
        });
    }

    const detectionResult = db.prepare(`
        INSERT INTO detections (plate_number, camera_id, vehicle_id, confidence, captured_at, image_ref, matched)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
    `).run(normalized, cameraId, vehicle ? vehicle.id : null, ocrConfidence, manualPlate ? 'manual-entry' : 'live-scan-frame', vehicle ? 1 : 0);
    const detectionId = Number(detectionResult.lastInsertRowid);

    const policy = vehicle
        ? runPolicyChecks({ plateNumber: normalized, vehicle, cameraId, detectionId })
        : { onWatchlist: null, alertCreated: false, compliance: [], emergency: null, corridorGranted: false };

    // Other plates seen in the same frame (multi-plate photos), with their
    // own registry status so the operator can tap through them.
    const otherPlateInfo = otherPlates.map((p) => {
        const v = db.prepare('SELECT plate_number, owner_name FROM vehicles WHERE plate_number = ?').get(p);
        return { plate: p, matched: !!v, ownerName: v?.owner_name || null };
    });

    res.json({
        plateFound: true,
        ocrRawText: rawText,
        ocrConfidence,
        plateNumber: normalized,
        matched: !!vehicle,
        vehicle: vehicle || null,
        suggestions,
        otherPlates: otherPlateInfo,
        detectionId,
        ...policy,
    });
});

// Connection details for scanning from a phone: the HTTPS LAN URL(s) of this
// server plus a QR code for the primary one. Camera access requires a secure
// origin, so these are https:// links.
router.get('/connect-info', async (req, res) => {
    const httpsPort = process.env.HTTPS_PORT || 4443;
    const ips = getLanIPs();
    const urls = ips.map((ip) => `https://${ip}:${httpsPort}/live-scan`);
    let qrDataUrl = null;
    if (urls.length > 0) {
        qrDataUrl = await QRCode.toDataURL(urls[0], { width: 240, margin: 1, color: { dark: '#e8edf7', light: '#16223a' } });
    }
    res.json({ urls, qrDataUrl });
});

router.get('/recent', (req, res) => {
    const cameraId = ensureScannerCamera();
    const rows = db.prepare(`
        SELECT d.*, v.owner_name FROM detections d
        LEFT JOIN vehicles v ON v.id = d.vehicle_id
        WHERE d.camera_id = ?
        ORDER BY d.captured_at DESC LIMIT 20
    `).all(cameraId);
    res.json({ data: rows });
});

export default router;
