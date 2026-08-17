import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
    const { page = '1', limit = '25', severity = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const where = severity ? 'WHERE w.severity = @severity' : '';
    const params = severity ? { severity } : {};
    const total = db.prepare(`SELECT COUNT(*) AS c FROM watchlist w ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT w.*, u.name AS added_by_name,
            (SELECT COUNT(*) FROM alerts a WHERE a.watchlist_id = w.id) AS alert_count
        FROM watchlist w
        LEFT JOIN users u ON u.id = w.added_by
        ${where}
        ORDER BY w.created_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post('/', requireRole('operator'), (req, res) => {
    const { plate_number, reason, severity = 'medium' } = req.body || {};
    if (!plate_number || !reason) {
        return res.status(400).json({ error: 'plate_number and reason are required' });
    }
    try {
        const result = db.prepare(`
            INSERT INTO watchlist (plate_number, reason, severity, added_by, active)
            VALUES (?, ?, ?, ?, 1)
        `).run(plate_number.toUpperCase(), reason, severity, req.user.id);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'Plate already on watchlist' });
        }
        throw err;
    }
});

router.patch('/:id', requireRole('operator'), (req, res) => {
    const { active } = req.body || {};
    const result = db.prepare('UPDATE watchlist SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Watchlist entry not found' });
    res.json({ ok: true });
});

router.delete('/:id', requireRole('operator'), (req, res) => {
    const result = db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Watchlist entry not found' });
    res.json({ ok: true });
});

export default router;
