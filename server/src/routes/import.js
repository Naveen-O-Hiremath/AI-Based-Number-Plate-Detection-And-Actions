import { Router } from 'express';
import { db } from '../db/connection.js';
import { parseCsv, toCsv } from '../lib/csv.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const PLATE_RE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TEMPLATES = {
    vehicles: {
        columns: [
            'plate_number', 'owner_name', 'owner_phone', 'owner_address', 'vehicle_type',
            'make', 'model', 'color', 'registration_date', 'insurance_expiry', 'permit_expiry', 'puc_expiry',
        ],
        example: {
            plate_number: 'KA53A5599',
            owner_name: 'Example Owner',
            owner_phone: '9876543210',
            owner_address: '12, Sample Street, Bengaluru',
            vehicle_type: 'Car',
            make: 'Maruti Suzuki',
            model: 'Swift',
            color: 'White',
            registration_date: '2022-05-14',
            insurance_expiry: '2027-05-13',
            permit_expiry: '2027-05-13',
            puc_expiry: '2026-11-14',
        },
    },
    watchlist: {
        columns: ['plate_number', 'reason', 'severity'],
        example: {
            plate_number: 'KA53A5599',
            reason: 'Reported stolen vehicle',
            severity: 'high',
        },
    },
};

router.get('/:entity/template', (req, res) => {
    const spec = TEMPLATES[req.params.entity];
    if (!spec) {
        return res.status(404).json({ error: `No template for this entity. Available: ${Object.keys(TEMPLATES).join(', ')}` });
    }
    const csv = toCsv([spec.example], spec.columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="anpr-${req.params.entity}-template.csv"`);
    res.send('﻿' + csv);
});

function validateVehicleRow(row, index) {
    const errors = [];
    const plate = (row.plate_number || '').toUpperCase().replace(/\s/g, '');
    if (!PLATE_RE.test(plate)) errors.push(`row ${index}: plate_number "${row.plate_number}" is not a valid plate format`);
    if (!row.owner_name) errors.push(`row ${index}: owner_name is required`);
    for (const dateCol of ['registration_date', 'insurance_expiry', 'permit_expiry', 'puc_expiry']) {
        if (row[dateCol] && !DATE_RE.test(row[dateCol])) {
            errors.push(`row ${index}: ${dateCol} "${row[dateCol]}" must be YYYY-MM-DD`);
        }
    }
    return { plate, errors };
}

router.post('/vehicles', requireRole('operator'), (req, res) => {
    const { csv } = req.body || {};
    if (!csv) return res.status(400).json({ error: 'Provide CSV content in the "csv" field' });

    const { header, records } = parseCsv(csv);
    const required = ['plate_number', 'owner_name'];
    const missing = required.filter((c) => !header.includes(c));
    if (missing.length) {
        return res.status(400).json({ error: `CSV is missing required column(s): ${missing.join(', ')}. Download the template for the expected format.` });
    }

    const insert = db.prepare(`
        INSERT INTO vehicles
            (plate_number, owner_name, owner_phone, owner_address, vehicle_type,
             make, model, color, registration_date, insurance_expiry, permit_expiry, puc_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;
    const errors = [];
    const defaultDate = new Date().toISOString().slice(0, 10);

    db.exec('BEGIN TRANSACTION');
    try {
        records.forEach((row, i) => {
            const { plate, errors: rowErrors } = validateVehicleRow(row, i + 2); // +2 = 1-based + header row
            if (rowErrors.length) {
                errors.push(...rowErrors);
                skipped++;
                return;
            }
            const exists = db.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(plate);
            if (exists) {
                skipped++;
                errors.push(`row ${i + 2}: plate ${plate} already exists — skipped`);
                return;
            }
            insert.run(
                plate, row.owner_name, row.owner_phone || '', row.owner_address || '',
                row.vehicle_type || 'Car', row.make || '', row.model || '', row.color || '',
                row.registration_date || defaultDate,
                row.insurance_expiry || defaultDate,
                row.permit_expiry || defaultDate,
                row.puc_expiry || defaultDate
            );
            inserted++;
        });
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    res.json({ inserted, skipped, totalRows: records.length, errors: errors.slice(0, 50) });
});

router.post('/watchlist', requireRole('operator'), (req, res) => {
    const { csv } = req.body || {};
    if (!csv) return res.status(400).json({ error: 'Provide CSV content in the "csv" field' });

    const { header, records } = parseCsv(csv);
    if (!header.includes('plate_number') || !header.includes('reason')) {
        return res.status(400).json({ error: 'CSV must have plate_number and reason columns. Download the template for the expected format.' });
    }

    const insert = db.prepare(
        'INSERT INTO watchlist (plate_number, reason, severity, added_by, active) VALUES (?, ?, ?, ?, 1)'
    );
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    db.exec('BEGIN TRANSACTION');
    try {
        records.forEach((row, i) => {
            const plate = (row.plate_number || '').toUpperCase().replace(/\s/g, '');
            if (!PLATE_RE.test(plate)) {
                errors.push(`row ${i + 2}: plate_number "${row.plate_number}" is not a valid plate format`);
                skipped++;
                return;
            }
            if (!row.reason) {
                errors.push(`row ${i + 2}: reason is required`);
                skipped++;
                return;
            }
            const exists = db.prepare('SELECT id FROM watchlist WHERE plate_number = ?').get(plate);
            if (exists) {
                skipped++;
                errors.push(`row ${i + 2}: plate ${plate} already on watchlist — skipped`);
                return;
            }
            const severity = validSeverities.includes((row.severity || '').toLowerCase())
                ? row.severity.toLowerCase()
                : 'medium';
            insert.run(plate, row.reason, severity, req.user.id);
            inserted++;
        });
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    res.json({ inserted, skipped, totalRows: records.length, errors: errors.slice(0, 50) });
});

export default router;
