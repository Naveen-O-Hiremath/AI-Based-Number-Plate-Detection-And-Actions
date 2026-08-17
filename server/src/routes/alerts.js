import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
    const { status = '', page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const where = status ? 'WHERE a.status = @status' : '';
    const params = status ? { status } : {};
    const total = db.prepare(`SELECT COUNT(*) AS c FROM alerts a ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT a.*, c.name AS camera_name, c.location AS camera_location,
               d.image_ref, d.confidence, w.reason AS watchlist_reason
        FROM alerts a
        JOIN cameras c ON c.id = a.camera_id
        JOIN detections d ON d.id = a.detection_id
        LEFT JOIN watchlist w ON w.id = a.watchlist_id
        ${where}
        ORDER BY a.created_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.patch('/:id', requireRole('operator'), (req, res) => {
    const { status } = req.body || {};
    if (!['open', 'confirmed', 'dismissed'].includes(status)) {
        return res.status(400).json({ error: 'status must be open, confirmed, or dismissed' });
    }
    const result = db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true });
});

export default router;
