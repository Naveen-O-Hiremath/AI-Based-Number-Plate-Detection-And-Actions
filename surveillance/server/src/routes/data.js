import { Router } from 'express';
import { db, audit } from '../db/connection.js';
import { broadcast } from '../ws/hub.js';
import { normalizePlate } from '../vision/normalize.js';

const router = Router();

const page = (req, fallback = 25) => {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || fallback));
    const p = Math.max(1, parseInt(req.query.page, 10) || 1);
    return { limit, offset: (p - 1) * limit, page: p };
};

/* ---------------------------------- vehicles --------------------------------- */

router.get('/vehicles', (req, res) => {
    const { limit, offset, page: p } = page(req);
    const { search = '', status = '' } = req.query;
    const clauses = [];
    const params = {};
    if (search) {
        clauses.push('(plate_number LIKE @search OR owner_name LIKE @search OR vehicle_model LIKE @search)');
        params.search = `%${search}%`;
    }
    if (status) { clauses.push('status = @status'); params.status = status; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) c FROM vehicles ${where}`).get(params).c;
    const data = db.prepare(`
        SELECT v.*,
            (SELECT COUNT(*) FROM fines f WHERE f.plate_number = v.plate_number AND f.paid_status = 'UNPAID') AS unpaid_fines,
            (SELECT COUNT(*) FROM movement_logs m WHERE m.plate_number = v.plate_number) AS sightings
        FROM vehicles v ${where} ORDER BY v.id DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });
    res.json({ data, total, page: p, limit });
});

router.get('/vehicles/:plate', (req, res) => {
    const plate = normalizePlate(req.params.plate);
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get(plate);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({
        vehicle,
        fines: db.prepare('SELECT * FROM fines WHERE plate_number = ? ORDER BY date_issued DESC').all(plate),
        movements: db.prepare(`
            SELECT m.*, c.label AS node_label, c.location AS node_location, c.lat, c.lng
            FROM movement_logs m LEFT JOIN camera_nodes c ON c.id = m.camera_node_id
            WHERE m.plate_number = ? ORDER BY m.detected_at DESC LIMIT 200
        `).all(plate),
    });
});

router.post('/vehicles', (req, res) => {
    const { plate_number, owner_name, vehicle_model, registration_date, status = 'NORMAL',
            status_reason, owner_phone, vehicle_color } = req.body || {};
    if (!plate_number || !owner_name || !vehicle_model) {
        return res.status(400).json({ error: 'plate_number, owner_name and vehicle_model are required' });
    }
    if (!['NORMAL', 'SURVEILLANCE', 'WANTED_CRIMINAL'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    const plate = normalizePlate(plate_number);
    try {
        db.prepare(`
            INSERT INTO vehicles (plate_number, owner_name, owner_phone, vehicle_model, vehicle_color,
                                  registration_date, status, status_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(plate, owner_name, owner_phone || null, vehicle_model, vehicle_color || null,
               registration_date || new Date().toISOString().slice(0, 10), status, status_reason || null);
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'Plate already registered' });
        }
        throw err;
    }
    audit('VEHICLE_ADDED', `Vehicle ${plate} added with status ${status}`);
    broadcast('registry_changed', { plate_number: plate, action: 'added', status });
    res.status(201).json({ ok: true, plate_number: plate });
});

router.patch('/vehicles/:plate/status', (req, res) => {
    const { status, status_reason } = req.body || {};
    if (!['NORMAL', 'SURVEILLANCE', 'WANTED_CRIMINAL'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    const plate = normalizePlate(req.params.plate);
    const result = db.prepare(
        'UPDATE vehicles SET status = ?, status_reason = ? WHERE plate_number = ?'
    ).run(status, status_reason || null, plate);
    if (result.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });

    audit('STATUS_CHANGED', `Vehicle ${plate} status changed to ${status}`);
    broadcast('registry_changed', { plate_number: plate, action: 'status_changed', status });
    res.json({ ok: true });
});

/* ----------------------------------- alerts ---------------------------------- */

router.get('/alerts', (req, res) => {
    const { limit, offset, page: p } = page(req);
    const onlyOpen = req.query.acknowledged === 'false';
    const where = onlyOpen ? 'WHERE a.acknowledged = 0' : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM alerts a ${where}`).get().c;
    const data = db.prepare(`
        SELECT a.*, v.owner_name, v.vehicle_model, v.status_reason, c.location AS node_location
        FROM alerts a
        LEFT JOIN vehicles v ON v.plate_number = a.plate_number
        LEFT JOIN camera_nodes c ON c.id = a.camera_node_id
        ${where} ORDER BY a.created_at DESC LIMIT @limit OFFSET @offset
    `).all({ limit, offset });
    res.json({ data, total, page: p, limit });
});

router.patch('/alerts/:id/acknowledge', (req, res) => {
    const result = db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
    audit('ALERT_ACKNOWLEDGED', `Alert ${req.params.id} acknowledged`);
    broadcast('alert_acknowledged', { id: Number(req.params.id) });
    res.json({ ok: true });
});

/* -------------------------------- movement logs ------------------------------ */

router.get('/movements', (req, res) => {
    const { limit, offset, page: p } = page(req, 50);
    const { plate = '', node = '' } = req.query;
    const clauses = [];
    const params = {};
    if (plate) { clauses.push('m.plate_number LIKE @plate'); params.plate = `%${plate}%`; }
    if (node) { clauses.push('m.camera_node_id = @node'); params.node = node; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) c FROM movement_logs m ${where}`).get(params).c;
    const data = db.prepare(`
        SELECT m.*, v.owner_name, v.vehicle_model, v.status, c.label AS node_label,
               c.location AS node_location, c.lat, c.lng
        FROM movement_logs m
        LEFT JOIN vehicles v ON v.plate_number = m.plate_number
        LEFT JOIN camera_nodes c ON c.id = m.camera_node_id
        ${where} ORDER BY m.detected_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });
    res.json({ data, total, page: p, limit });
});

/** Surveillance tracking: the movement path of every flagged vehicle. */
router.get('/surveillance/trails', (req, res) => {
    const vehicles = db.prepare(`
        SELECT plate_number, owner_name, vehicle_model, status, status_reason
        FROM vehicles WHERE status != 'NORMAL' ORDER BY status DESC, plate_number
    `).all();
    const trailStmt = db.prepare(`
        SELECT m.camera_node_id, m.detected_at, m.snapshot_url, m.confidence,
               c.label AS node_label, c.location AS node_location, c.lat, c.lng
        FROM movement_logs m LEFT JOIN camera_nodes c ON c.id = m.camera_node_id
        WHERE m.plate_number = ? ORDER BY m.detected_at DESC LIMIT 50
    `);
    res.json({
        data: vehicles.map((v) => ({ ...v, trail: trailStmt.all(v.plate_number) }))
            .filter((v) => v.trail.length > 0),
    });
});

/* ----------------------------------- nodes ----------------------------------- */

router.get('/nodes', (req, res) => {
    res.json({
        data: db.prepare(`
            SELECT c.*, (SELECT COUNT(*) FROM movement_logs m WHERE m.camera_node_id = c.id) AS detections
            FROM camera_nodes c ORDER BY c.id
        `).all(),
    });
});

/* --------------------------------- audit logs -------------------------------- */

router.get('/audit', (req, res) => {
    const { limit, offset, page: p } = page(req, 50);
    const { event_type = '' } = req.query;
    const where = event_type ? 'WHERE event_type = @event_type' : '';
    const params = event_type ? { event_type } : {};
    const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs ${where}`).get(params).c;
    const data = db.prepare(
        `SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset });
    res.json({ data, total, page: p, limit });
});

/* ----------------------------------- stats ----------------------------------- */

router.get('/stats', (req, res) => {
    const one = (sql) => db.prepare(sql).get().c;
    res.json({
        vehicles: one('SELECT COUNT(*) c FROM vehicles'),
        wanted: one("SELECT COUNT(*) c FROM vehicles WHERE status = 'WANTED_CRIMINAL'"),
        surveillance: one("SELECT COUNT(*) c FROM vehicles WHERE status = 'SURVEILLANCE'"),
        detections: one('SELECT COUNT(*) c FROM movement_logs'),
        detections_today: one("SELECT COUNT(*) c FROM movement_logs WHERE date(detected_at) = date('now')"),
        open_alerts: one('SELECT COUNT(*) c FROM alerts WHERE acknowledged = 0'),
        total_alerts: one('SELECT COUNT(*) c FROM alerts'),
        unpaid_fines: one("SELECT COUNT(*) c FROM fines WHERE paid_status = 'UNPAID'"),
        amount_due: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM fines WHERE paid_status = 'UNPAID'").get().c,
        nodes: one('SELECT COUNT(*) c FROM camera_nodes'),
        by_status: db.prepare('SELECT status, COUNT(*) count FROM vehicles GROUP BY status').all(),
        detections_by_day: db.prepare(`
            SELECT date(detected_at) day, COUNT(*) count FROM movement_logs
            GROUP BY day ORDER BY day DESC LIMIT 14
        `).all().reverse(),
        top_nodes: db.prepare(`
            SELECT camera_node_id, COUNT(*) count FROM movement_logs
            GROUP BY camera_node_id ORDER BY count DESC LIMIT 8
        `).all(),
    });
});

/* ----------------------------------- export ---------------------------------- */

function toCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

const EXPORTS = {
    vehicles: 'SELECT * FROM vehicles ORDER BY id',
    fines: 'SELECT * FROM fines ORDER BY id',
    movements: 'SELECT * FROM movement_logs ORDER BY detected_at DESC',
    alerts: 'SELECT * FROM alerts ORDER BY created_at DESC',
    audit: 'SELECT * FROM audit_logs ORDER BY id DESC',
};

router.get('/export/:entity.:format(csv|json)', (req, res) => {
    const { entity, format } = req.params;
    const sql = EXPORTS[entity];
    if (!sql) return res.status(404).json({ error: `Unknown export entity: ${entity}` });

    const rows = db.prepare(sql).all();
    audit('EXPORT', `Exported ${rows.length} ${entity} rows as ${format.toUpperCase()}`);
    const filename = `${entity}-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(rows, null, 2));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(toCsv(rows));
});

export default router;
