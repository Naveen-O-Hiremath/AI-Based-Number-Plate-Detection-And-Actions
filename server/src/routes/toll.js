import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/nakas', (req, res) => {
    const rows = db.prepare(`
        SELECT t.*, c.status AS camera_status,
            (SELECT COUNT(*) FROM toll_transactions tx WHERE tx.naka_id = t.id) AS transaction_count
        FROM toll_nakas t LEFT JOIN cameras c ON c.id = t.camera_id
        ORDER BY t.id
    `).all();
    res.json({ data: rows });
});

router.get('/transactions', (req, res) => {
    const { naka_id = '', status = '', page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const clauses = [];
    const params = {};
    if (naka_id) {
        clauses.push('tx.naka_id = @naka_id');
        params.naka_id = naka_id;
    }
    if (status) {
        clauses.push('tx.status = @status');
        params.status = status;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM toll_transactions tx ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT tx.*, n.name AS naka_name, n.highway
        FROM toll_transactions tx JOIN toll_nakas n ON n.id = tx.naka_id
        ${where}
        ORDER BY tx.occurred_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

export default router;
