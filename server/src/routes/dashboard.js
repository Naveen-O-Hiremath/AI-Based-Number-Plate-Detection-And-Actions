import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/stats', (req, res) => {
    const counts = {};
    for (const t of ['vehicles', 'cameras', 'watchlist', 'detections', 'alerts', 'notifications', 'emergency_vehicles', 'toll_transactions']) {
        counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    }
    counts.openAlerts = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = 'open'").get().c;
    counts.onDutyEmergencyVehicles = db.prepare('SELECT COUNT(*) AS c FROM emergency_vehicles WHERE on_duty = 1').get().c;
    counts.onlineCameras = db.prepare("SELECT COUNT(*) AS c FROM cameras WHERE status = 'online'").get().c;

    const detectionsByDay = db.prepare(`
        SELECT date(captured_at) AS day, COUNT(*) AS count FROM detections
        GROUP BY day ORDER BY day DESC LIMIT 14
    `).all().reverse();

    const alertsBySeverity = db.prepare(`
        SELECT severity, COUNT(*) AS count FROM alerts GROUP BY severity
    `).all();

    const cameraTypeBreakdown = db.prepare(`
        SELECT type, COUNT(*) AS count FROM cameras GROUP BY type
    `).all();

    res.json({ counts, detectionsByDay, alertsBySeverity, cameraTypeBreakdown });
});

export default router;
