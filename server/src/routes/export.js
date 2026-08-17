import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCsv } from '../lib/csv.js';

const router = Router();

// Each entity maps to a query producing spreadsheet-friendly columns.
const EXPORTS = {
    vehicles: {
        filename: 'vehicles',
        query: `
            SELECT plate_number, owner_name, owner_phone, owner_address, vehicle_type,
                   make, model, color, registration_date, insurance_expiry, permit_expiry, puc_expiry
            FROM vehicles ORDER BY plate_number
        `,
    },
    watchlist: {
        filename: 'watchlist',
        query: `
            SELECT w.plate_number, w.reason, w.severity,
                   CASE w.active WHEN 1 THEN 'active' ELSE 'inactive' END AS status,
                   u.name AS added_by, w.created_at
            FROM watchlist w LEFT JOIN users u ON u.id = w.added_by
            ORDER BY w.created_at DESC
        `,
    },
    detections: {
        filename: 'detections',
        query: `
            SELECT d.plate_number, c.name AS camera, c.location, d.confidence,
                   CASE d.matched WHEN 1 THEN 'matched' ELSE 'unmatched' END AS matched,
                   d.captured_at
            FROM detections d JOIN cameras c ON c.id = d.camera_id
            ORDER BY d.captured_at DESC
        `,
    },
    alerts: {
        filename: 'rogue-plate-alerts',
        query: `
            SELECT a.plate_number, a.severity, a.status, w.reason,
                   c.name AS camera, c.location, a.created_at
            FROM alerts a
            JOIN cameras c ON c.id = a.camera_id
            LEFT JOIN watchlist w ON w.id = a.watchlist_id
            ORDER BY a.created_at DESC
        `,
    },
    notifications: {
        filename: 'compliance-notifications',
        query: `
            SELECT v.plate_number, v.owner_name, n.type, n.channel, n.message, n.sent_at
            FROM notifications n JOIN vehicles v ON v.id = n.vehicle_id
            ORDER BY n.sent_at DESC
        `,
    },
    emergency: {
        filename: 'emergency-fleet',
        query: `
            SELECT v.plate_number, e.fleet_type, e.driver_name, e.driver_phone, e.driver_app_id,
                   CASE e.on_duty WHEN 1 THEN 'on duty' ELSE 'off duty' END AS duty_status,
                   e.registered_at
            FROM emergency_vehicles e JOIN vehicles v ON v.id = e.vehicle_id
            ORDER BY e.id
        `,
    },
    corridor: {
        filename: 'green-corridor-events',
        query: `
            SELECT v.plate_number, e.fleet_type, e.driver_name, c.name AS camera,
                   c.location, g.signal_id, g.granted_at
            FROM green_corridor_events g
            JOIN emergency_vehicles e ON e.id = g.emergency_vehicle_id
            JOIN vehicles v ON v.id = e.vehicle_id
            JOIN cameras c ON c.id = g.camera_id
            ORDER BY g.granted_at DESC
        `,
    },
    toll: {
        filename: 'toll-transactions',
        query: `
            SELECT tx.plate_number, n.name AS naka, n.highway, tx.amount, tx.status, tx.occurred_at
            FROM toll_transactions tx JOIN toll_nakas n ON n.id = tx.naka_id
            ORDER BY tx.occurred_at DESC
        `,
    },
};

router.get('/:entity', (req, res) => {
    const spec = EXPORTS[req.params.entity];
    if (!spec) {
        return res.status(404).json({ error: `Unknown export entity. Available: ${Object.keys(EXPORTS).join(', ')}` });
    }
    const rows = db.prepare(spec.query).all();
    const csv = toCsv(rows);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="anpr-${spec.filename}-${date}.csv"`);
    // BOM so Excel opens UTF-8 correctly.
    res.send('﻿' + csv);
});

export default router;
