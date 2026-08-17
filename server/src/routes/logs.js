import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

// Unified, searchable event log across detections, alerts, notifications,
// green-corridor events, and toll transactions — powers "Full logs" in the console.
router.get('/', (req, res) => {
    const { q = '', event_type = '', page = '1', limit = '30' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;
    const like = `%${q}%`;

    const parts = [];
    if (!event_type || event_type === 'detection') {
        parts.push(`
            SELECT 'detection' AS event_type, d.id, d.plate_number, c.location AS location,
                   d.captured_at AS occurred_at, NULL AS detail
            FROM detections d JOIN cameras c ON c.id = d.camera_id
            WHERE d.plate_number LIKE @like
        `);
    }
    if (!event_type || event_type === 'alert') {
        parts.push(`
            SELECT 'alert' AS event_type, a.id, a.plate_number, c.location AS location,
                   a.created_at AS occurred_at, a.status AS detail
            FROM alerts a JOIN cameras c ON c.id = a.camera_id
            WHERE a.plate_number LIKE @like
        `);
    }
    if (!event_type || event_type === 'notification') {
        parts.push(`
            SELECT 'notification' AS event_type, n.id, v.plate_number, NULL AS location,
                   n.sent_at AS occurred_at, n.type AS detail
            FROM notifications n JOIN vehicles v ON v.id = n.vehicle_id
            WHERE v.plate_number LIKE @like
        `);
    }
    if (!event_type || event_type === 'toll') {
        parts.push(`
            SELECT 'toll' AS event_type, tx.id, tx.plate_number, nk.location AS location,
                   tx.occurred_at AS occurred_at, tx.status AS detail
            FROM toll_transactions tx JOIN toll_nakas nk ON nk.id = tx.naka_id
            WHERE tx.plate_number LIKE @like
        `);
    }
    if (!event_type || event_type === 'corridor') {
        parts.push(`
            SELECT 'corridor' AS event_type, g.id, v.plate_number, c.location AS location,
                   g.granted_at AS occurred_at, g.signal_id AS detail
            FROM green_corridor_events g
            JOIN emergency_vehicles e ON e.id = g.emergency_vehicle_id
            JOIN vehicles v ON v.id = e.vehicle_id
            JOIN cameras c ON c.id = g.camera_id
            WHERE v.plate_number LIKE @like
        `);
    }

    const union = parts.join(' UNION ALL ');
    const total = db.prepare(`SELECT COUNT(*) AS c FROM (${union})`).get({ like }).c;
    const rows = db.prepare(`
        SELECT * FROM (${union}) ORDER BY occurred_at DESC LIMIT @limit OFFSET @offset
    `).all({ like, limit: limitNum, offset });

    res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

export default router;
