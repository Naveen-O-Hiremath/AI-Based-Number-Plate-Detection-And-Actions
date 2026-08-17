import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
    const { fleet_type = '', on_duty = '', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const clauses = [];
    const params = {};
    if (fleet_type) {
        clauses.push('e.fleet_type = @fleet_type');
        params.fleet_type = fleet_type;
    }
    if (on_duty !== '') {
        clauses.push('e.on_duty = @on_duty');
        params.on_duty = on_duty === 'true' ? 1 : 0;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM emergency_vehicles e ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT e.*, v.plate_number, v.make, v.model, v.color,
            (SELECT COUNT(*) FROM green_corridor_events g WHERE g.emergency_vehicle_id = e.id) AS corridor_count
        FROM emergency_vehicles e JOIN vehicles v ON v.id = e.vehicle_id
        ${where}
        ORDER BY e.on_duty DESC, e.id
        LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });
    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post('/', requireRole('operator'), (req, res) => {
    const { plate_number, fleet_type, driver_name, driver_phone, driver_app_id } = req.body || {};
    if (!plate_number || !fleet_type || !driver_name || !driver_app_id) {
        return res.status(400).json({ error: 'plate_number, fleet_type, driver_name, driver_app_id are required' });
    }
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(plate_number.toUpperCase());
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found in registry' });

    try {
        const result = db.prepare(`
            INSERT INTO emergency_vehicles (vehicle_id, fleet_type, driver_name, driver_phone, driver_app_id, on_duty)
            VALUES (?, ?, ?, ?, ?, 0)
        `).run(vehicle.id, fleet_type, driver_name, driver_phone || '', driver_app_id);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'Driver app ID already registered' });
        }
        throw err;
    }
});

// Simulates the companion driver app toggling duty mode.
router.patch('/:id/duty', requireRole('operator'), (req, res) => {
    const { on_duty } = req.body || {};
    const result = db.prepare('UPDATE emergency_vehicles SET on_duty = ? WHERE id = ?').run(on_duty ? 1 : 0, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Emergency vehicle not found' });

    if (on_duty) {
        const camera = db.prepare('SELECT id FROM cameras ORDER BY RANDOM() LIMIT 1').get();
        if (camera) {
            db.prepare(`
                INSERT INTO green_corridor_events (emergency_vehicle_id, camera_id, signal_id, granted_at)
                VALUES (?, ?, ?, datetime('now'))
            `).run(req.params.id, camera.id, `SIG-${Math.floor(100 + Math.random() * 900)}`);
        }
    }
    res.json({ ok: true });
});

router.get('/corridor-events', (req, res) => {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const total = db.prepare('SELECT COUNT(*) AS c FROM green_corridor_events').get().c;
    const rows = db.prepare(`
        SELECT g.*, e.fleet_type, e.driver_name, v.plate_number, c.name AS camera_name, c.location AS camera_location
        FROM green_corridor_events g
        JOIN emergency_vehicles e ON e.id = g.emergency_vehicle_id
        JOIN vehicles v ON v.id = e.vehicle_id
        JOIN cameras c ON c.id = g.camera_id
        ORDER BY g.granted_at DESC LIMIT @limit OFFSET @offset
    `).all({ limit: limitNum, offset });
    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

export default router;
