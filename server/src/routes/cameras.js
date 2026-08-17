import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
    const { type = '' } = req.query;
    const where = type ? 'WHERE type = @type' : '';
    const params = type ? { type } : {};
    const rows = db.prepare(`
        SELECT cam.*, (SELECT COUNT(*) FROM detections d WHERE d.camera_id = cam.id) AS detection_count
        FROM cameras cam ${where} ORDER BY cam.id
    `).all(params);
    res.json({ data: rows });
});

export default router;
