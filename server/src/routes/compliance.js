import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/notifications', (req, res) => {
    const { type = '', page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const where = type ? 'WHERE n.type = @type' : '';
    const params = type ? { type } : {};
    const total = db.prepare(`SELECT COUNT(*) AS c FROM notifications n ${where}`).get(params).c;
    const rows = db.prepare(`
        SELECT n.*, v.plate_number, v.owner_name
        FROM notifications n JOIN vehicles v ON v.id = n.vehicle_id
        ${where}
        ORDER BY n.sent_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.get('/stats', (req, res) => {
    const byType = db.prepare(`
        SELECT type, COUNT(*) AS count FROM notifications GROUP BY type
    `).all();
    const expiringVehicles = db.prepare(`
        SELECT COUNT(*) AS c FROM vehicles
        WHERE date(insurance_expiry) < date('now', '+30 days')
           OR date(permit_expiry) < date('now', '+30 days')
           OR date(puc_expiry) < date('now', '+30 days')
    `).get().c;
    res.json({ byType, expiringVehicles });
});

export default router;
