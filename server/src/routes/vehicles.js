import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
    const { search = '', type = '', page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const clauses = [];
    const params = {};
    if (search) {
        clauses.push('(plate_number LIKE @search OR owner_name LIKE @search)');
        params.search = `%${search}%`;
    }
    if (type) {
        clauses.push('vehicle_type = @type');
        params.type = type;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM vehicles ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT * FROM vehicles ${where}
        ORDER BY id DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.get('/:plate', (req, res) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get(req.params.plate.toUpperCase());
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const onWatchlist = db.prepare('SELECT * FROM watchlist WHERE plate_number = ? AND active = 1').get(vehicle.plate_number);
    const recentDetections = db.prepare(`
        SELECT d.*, c.name AS camera_name, c.location AS camera_location
        FROM detections d JOIN cameras c ON c.id = d.camera_id
        WHERE d.plate_number = ? ORDER BY d.captured_at DESC LIMIT 20
    `).all(vehicle.plate_number);

    res.json({ vehicle, onWatchlist: onWatchlist || null, recentDetections });
});

export default router;
