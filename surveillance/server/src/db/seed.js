import { db, initSchema, audit } from './connection.js';

const STATES = ['KL', 'KA', 'MH', 'TN', 'DL', 'AP', 'TS', 'GJ', 'RJ', 'UP', 'WB', 'PB'];
const FIRST = ['Aarav', 'Vivaan', 'Arjun', 'Rohan', 'Karan', 'Rahul', 'Suresh', 'Vikram', 'Deepak', 'Naveen',
    'Ananya', 'Diya', 'Kavya', 'Meera', 'Priya', 'Riya', 'Aditi', 'Neha', 'Sneha', 'Divya'];
const LAST = ['Sharma', 'Verma', 'Reddy', 'Nair', 'Menon', 'Iyer', 'Pillai', 'Patel', 'Shah', 'Mehta',
    'Singh', 'Kumar', 'Yadav', 'Kapoor', 'Bhat', 'Hegde', 'Gowda', 'Shetty', 'Joshi', 'Pandey'];
const MODELS = ['Maruti Swift', 'Hyundai i20', 'Tata Nexon', 'Honda City', 'Mahindra XUV700', 'Toyota Fortuner',
    'Kia Seltos', 'Maruti Baleno', 'Tata Punch', 'Hyundai Creta', 'Honda Amaze', 'Mahindra Thar'];
const COLORS = ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Brown', 'Green'];
const VIOLATIONS = ['Over-speeding', 'Signal jumping', 'No parking', 'Wrong lane', 'No helmet',
    'Rash driving', 'Expired PUC', 'Overloading'];
const CRIME_REASONS = [
    'Reported stolen — inter-state alert',
    'Wanted in connection with armed robbery',
    'Absconding accused — court warrant',
    'Linked to narcotics trafficking case',
    'Suspected use in kidnapping case',
];
const WATCH_REASONS = [
    'Person of interest — under observation',
    'Frequent unauthorised zone entry',
    'Linked to ongoing financial investigation',
    'Movement tracking requested by crime branch',
];

const NODES = [
    ['NODE-01', 'North Gate Camera', 'North Gate Junction', 12.9716, 77.5946],
    ['NODE-02', 'Highway Entry', 'NH-44 Entry Ramp', 12.9800, 77.6100],
    ['NODE-03', 'City Centre', 'MG Road Crossing', 12.9750, 77.6050],
    ['NODE-04', 'Toll Plaza', 'Electronic City Toll', 12.8450, 77.6600],
    ['NODE-05', 'South Exit', 'Silk Board Junction', 12.9170, 77.6230],
    ['MOBILE-01', 'Patrol Phone A', 'Mobile Unit — Patrol A', null, null],
];

// Simple, easy-to-write plates for physical scale-model car testing.
// One per status so every business-logic branch is reachable with a toy car.
const TEST_PLATES = [
    { plate: 'KL07B1234', status: 'NORMAL', owner: 'Rajesh Menon', model: 'Maruti Swift', color: 'Red',
      reason: null, fines: [['Over-speeding', 1500, 'UNPAID'], ['No parking', 500, 'UNPAID']] },
    { plate: 'KA01AB1111', status: 'SURVEILLANCE', owner: 'Anil Kumar', model: 'Hyundai Creta', color: 'White',
      reason: 'Person of interest — under observation', fines: [['Signal jumping', 1000, 'UNPAID']] },
    { plate: 'MH12CD2222', status: 'WANTED_CRIMINAL', owner: 'Unknown / Forged Registration', model: 'Tata Nexon', color: 'Black',
      reason: 'Reported stolen — inter-state alert', fines: [['Rash driving', 2500, 'UNPAID'], ['Over-speeding', 1500, 'UNPAID']] },
    { plate: 'TN09XY7777', status: 'WANTED_CRIMINAL', owner: 'Suspect — Case #4471', model: 'Mahindra Thar', color: 'Grey',
      reason: 'Wanted in connection with armed robbery', fines: [] },
    { plate: 'DL03EF4444', status: 'SURVEILLANCE', owner: 'Priya Sharma', model: 'Honda City', color: 'Silver',
      reason: 'Movement tracking requested by crime branch', fines: [] },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n, w) => String(n).padStart(w, '0');
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function isoAgo(minutes) {
    return new Date(Date.now() - minutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
}

function reset() {
    for (const t of ['audit_logs', 'alerts', 'movement_logs', 'camera_nodes', 'fines', 'vehicles']) {
        db.exec(`DELETE FROM ${t}`);
    }
    db.exec(
        "DELETE FROM sqlite_sequence WHERE name IN ('audit_logs','alerts','movement_logs','fines','vehicles')"
    );
}

function run() {
    console.log('=== Seeding ANPR surveillance database ===');
    initSchema();
    reset();
    db.exec('BEGIN TRANSACTION');

    const insertVehicle = db.prepare(`
        INSERT INTO vehicles (plate_number, owner_name, owner_phone, owner_address, vehicle_model,
                              vehicle_color, registration_date, status, status_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFine = db.prepare(`
        INSERT INTO fines (plate_number, violation_type, amount, date_issued, paid_status)
        VALUES (?, ?, ?, ?, ?)
    `);

    // 1. Deterministic test plates first, so they're always present and easy to demo.
    for (const t of TEST_PLATES) {
        insertVehicle.run(t.plate, t.owner, `9${randInt(100000000, 999999999)}`,
            `${randInt(1, 300)}, MG Road, Bengaluru`, t.model, t.color,
            daysAgo(randInt(200, 3000)), t.status, t.reason);
        for (const [violation, amount, paid] of t.fines) {
            insertFine.run(t.plate, violation, amount, daysAgo(randInt(5, 400)), paid);
        }
    }

    // 2. Bulk fake registry.
    const used = new Set(TEST_PLATES.map((t) => t.plate));
    const plates = [...used];
    const TARGET = 1200;
    while (plates.length < TARGET) {
        const plate = `${pick(STATES)}${pad(randInt(1, 60), 2)}${pick(LETTERS.split(''))}${pick(LETTERS.split(''))}${pad(randInt(1, 9999), 4)}`;
        if (used.has(plate)) continue;
        used.add(plate);
        plates.push(plate);

        // ~2% wanted, ~5% surveillance, rest normal.
        const roll = Math.random();
        let status = 'NORMAL';
        let reason = null;
        if (roll < 0.02) {
            status = 'WANTED_CRIMINAL';
            reason = pick(CRIME_REASONS);
        } else if (roll < 0.07) {
            status = 'SURVEILLANCE';
            reason = pick(WATCH_REASONS);
        }

        insertVehicle.run(plate, `${pick(FIRST)} ${pick(LAST)}`, `9${randInt(100000000, 999999999)}`,
            `${randInt(1, 400)}, ${pick(['MG Road', 'Ring Road', 'Station Road', 'Model Colony'])}, ${pick(['Bengaluru', 'Chennai', 'Kochi', 'Mumbai', 'Pune'])}`,
            pick(MODELS), pick(COLORS), daysAgo(randInt(30, 5000)), status, reason);

        for (let f = 0; f < randInt(0, 3); f++) {
            insertFine.run(plate, pick(VIOLATIONS), pick([500, 1000, 1500, 2000, 2500, 5000]),
                daysAgo(randInt(1, 500)), Math.random() < 0.45 ? 'PAID' : 'UNPAID');
        }
    }

    // 3. Camera nodes.
    const insertNode = db.prepare(
        'INSERT INTO camera_nodes (id, label, location, lat, lng, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const [id, label, location, lat, lng] of NODES) {
        insertNode.run(id, label, location, lat, lng, isoAgo(randInt(1, 120)));
    }

    // 4. Historical movement trail — heavier for flagged vehicles so the tracking
    //    tab has a real path to draw on first load.
    const insertMovement = db.prepare(`
        INSERT INTO movement_logs (plate_number, camera_node_id, detected_at, snapshot_url,
                                   confidence, vision_source, matched, status_at_detection)
        VALUES (?, ?, ?, ?, ?, 'seed', 1, ?)
    `);
    const statusOf = db.prepare('SELECT status FROM vehicles WHERE plate_number = ?');
    let movements = 0;
    const flagged = db.prepare(
        "SELECT plate_number FROM vehicles WHERE status != 'NORMAL'"
    ).all().map((r) => r.plate_number);

    for (const plate of flagged) {
        const st = statusOf.get(plate).status;
        // Walk the vehicle across nodes over the last few days.
        let minutes = randInt(60, 4000);
        for (let i = 0; i < randInt(4, 12); i++) {
            const node = pick(NODES)[0];
            insertMovement.run(plate, node, isoAgo(minutes), `/snapshots/${plate}-${minutes}.jpg`,
                +(0.85 + Math.random() * 0.14).toFixed(3), st);
            minutes -= randInt(15, 400);
            if (minutes < 1) break;
            movements++;
        }
    }
    for (let i = 0; i < 900; i++) {
        const plate = pick(plates);
        const st = statusOf.get(plate)?.status || 'NORMAL';
        insertMovement.run(plate, pick(NODES)[0], isoAgo(randInt(1, 10080)),
            `/snapshots/${plate}-${i}.jpg`, +(0.82 + Math.random() * 0.17).toFixed(3), st);
        movements++;
    }

    // 5. Alerts for historical wanted-vehicle sightings.
    const insertAlert = db.prepare(`
        INSERT INTO alerts (plate_number, movement_log_id, camera_node_id, severity, message, acknowledged, created_at)
        VALUES (?, ?, ?, 'CRITICAL', ?, ?, ?)
    `);
    const wantedSightings = db.prepare(`
        SELECT m.id, m.plate_number, m.camera_node_id, m.detected_at
        FROM movement_logs m JOIN vehicles v ON v.plate_number = m.plate_number
        WHERE v.status = 'WANTED_CRIMINAL'
        ORDER BY m.detected_at DESC LIMIT 40
    `).all();
    for (const s of wantedSightings) {
        insertAlert.run(s.plate_number, s.id, s.camera_node_id,
            `WANTED vehicle ${s.plate_number} detected at ${s.camera_node_id}`,
            Math.random() < 0.5 ? 1 : 0, s.detected_at);
    }

    audit('SYSTEM', 'Database seeded with demo data');
    db.exec('COMMIT');

    const counts = {};
    for (const t of ['vehicles', 'fines', 'camera_nodes', 'movement_logs', 'alerts', 'audit_logs']) {
        counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
    }
    console.table(counts);
    console.log('\nStatus breakdown:');
    console.table(db.prepare('SELECT status, COUNT(*) count FROM vehicles GROUP BY status').all());
    console.log('\n=== TEST PLATES (write these on your scale-model cars) ===');
    for (const t of TEST_PLATES) console.log(`  ${t.plate.padEnd(12)} ${t.status}`);
}

run();
