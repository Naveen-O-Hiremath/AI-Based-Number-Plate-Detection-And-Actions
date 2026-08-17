import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
    const { plate = '', camera_id = '', page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const clauses = [];
    const params = {};
    if (plate) {
        clauses.push('d.plate_number LIKE @plate');
        params.plate = `%${plate}%`;
    }
    if (camera_id) {
        clauses.push('d.camera_id = @camera_id');
        params.camera_id = camera_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM detections d ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT d.*, c.name AS camera_name, c.location AS camera_location, c.type AS camera_type
        FROM detections d JOIN cameras c ON c.id = d.camera_id
        ${where}
        ORDER BY d.captured_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

export default router;
