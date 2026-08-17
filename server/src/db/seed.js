import bcrypt from 'bcryptjs';
import { db, initSchema } from './connection.js';
import {
    STATE_CODES, CITIES_BY_STATE, FIRST_NAMES, LAST_NAMES, VEHICLE_TYPES,
    COLORS, RTO_SERIES_LETTERS, ROGUE_REASONS, CAMERA_LOCATION_NAMES,
    pick, randInt, pad, randomDateBetween, toSqlDateTime, toSqlDate,
} from './demoData.js';

const VEHICLE_COUNT = 5000;
const CAMERA_COUNT = 96;
const TOLL_NAKA_COUNT = 8;
const DETECTION_COUNT = 42000;
const EMERGENCY_VEHICLE_COUNT = 60;
const TOLL_TRANSACTION_COUNT = 9000;

function log(msg) {
    console.log(`[seed] ${msg}`);
}

function resetTables() {
    const tables = [
        'toll_transactions', 'green_corridor_events', 'emergency_vehicles',
        'notifications', 'alerts', 'detections', 'toll_nakas', 'cameras',
        'watchlist', 'vehicles', 'users',
    ];
    for (const t of tables) db.exec(`DELETE FROM ${t}`);
    // Reset AUTOINCREMENT counters so re-seeding always yields the same IDs
    // (e.g. the admin user is always id 1) instead of climbing forever.
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map((t) => `'${t}'`).join(',')})`);
}

function generatePlateNumber(used) {
    let plate;
    do {
        const state = pick(STATE_CODES);
        const rto = pad(randInt(1, 60), 2);
        const seriesLen = Math.random() < 0.7 ? 2 : 1;
        let series = '';
        for (let i = 0; i < seriesLen; i++) series += pick(RTO_SERIES_LETTERS.split(''));
        const number = pad(randInt(1, 9999), 4);
        plate = `${state}${rto}${series}${number}`;
    } while (used.has(plate));
    used.add(plate);
    return plate;
}

function seedUsers() {
    log('Seeding users...');
    const insert = db.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );
    const demoUsers = [
        ['Anita Rao', 'admin@anpr-demo.gov.in', 'admin123', 'admin'],
        ['Suresh Patil', 'operator@anpr-demo.gov.in', 'operator123', 'operator'],
        ['Kavya Menon', 'viewer@anpr-demo.gov.in', 'viewer123', 'viewer'],
    ];
    for (const [name, email, pass, role] of demoUsers) {
        insert.run(name, email, bcrypt.hashSync(pass, 10), role);
    }
    log(`  ${demoUsers.length} users created (passwords: admin123 / operator123 / viewer123)`);
}

function seedVehicles() {
    log(`Seeding ${VEHICLE_COUNT} vehicles...`);
    const insert = db.prepare(`
        INSERT INTO vehicles
            (plate_number, owner_name, owner_phone, owner_address, vehicle_type,
             make, model, color, registration_date, insurance_expiry, permit_expiry, puc_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const used = new Set();
    const plates = [];

    for (let i = 0; i < VEHICLE_COUNT; i++) {
        const plate = generatePlateNumber(used);
        plates.push(plate);
        const state = plate.slice(0, 2);
        const city = pick(CITIES_BY_STATE[state] || ['Unknown']);
        const ownerName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const phone = `9${randInt(100000000, 999999999)}`;
        const address = `${randInt(1, 400)}, ${pick(['MG Road', 'Ring Road', 'Station Road', 'Church Street', 'Gandhi Nagar', 'Model Colony'])}, ${city}`;
        const vt = pick(VEHICLE_TYPES);
        const makeName = pick(Object.keys(vt.makes));
        const model = pick(vt.makes[makeName]);
        const color = pick(COLORS);

        const regDate = randomDateBetween(30, 15 * 365);
        // Spread expiries across past (expired), near-term (expiring soon) and future.
        const insuranceExpiry = randomDateBetween(-180, 200); // negative = future via helper below
        const permitExpiry = randomDateBetween(-180, 200);
        const pucExpiry = randomDateBetween(-90, 120);

        insert.run(
            plate, ownerName, phone, address, vt.type, makeName, model, color,
            toSqlDate(regDate),
            toSqlDate(insuranceExpiry),
            toSqlDate(permitExpiry),
            toSqlDate(pucExpiry)
        );
    }
    return plates;
}

function seedCameras() {
    log(`Seeding ${CAMERA_COUNT} cameras...`);
    const insert = db.prepare(
        'INSERT INTO cameras (name, type, location, lat, lng, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const ids = [];
    const tollLocations = ['Vashi Toll Plaza', 'Electronic City Toll', 'Hosur Road Toll', 'Kherki Daula Toll', 'Panvel Toll', 'Attibele Toll', 'Bahadurgarh Toll', 'Dankuni Toll'];

    for (let i = 0; i < CAMERA_COUNT; i++) {
        let type = 'endpoint';
        if (i < TOLL_NAKA_COUNT) type = 'toll';
        else if (i % 4 === 0) type = 'mobile';

        const location = type === 'toll' ? tollLocations[i] : pick(CAMERA_LOCATION_NAMES);
        const name = type === 'toll' ? `Toll-Cam-${i + 1}` : type === 'mobile' ? `Mobile-Unit-${i + 1}` : `Endpoint-Cam-${i + 1}`;
        const lat = 8 + Math.random() * 20; // rough India latitude band
        const lng = 72 + Math.random() * 16; // rough India longitude band
        const status = Math.random() < 0.05 ? 'offline' : Math.random() < 0.03 ? 'maintenance' : 'online';

        const res = insert.run(name, type, location, lat, lng, status);
        ids.push({ id: Number(res.lastInsertRowid), type, location });
    }
    return ids;
}

function seedTollNakas(cameras) {
    log(`Seeding ${TOLL_NAKA_COUNT} toll nakas...`);
    const tollCameras = cameras.filter((c) => c.type === 'toll');
    const insert = db.prepare(
        'INSERT INTO toll_nakas (name, highway, location, camera_id) VALUES (?, ?, ?, ?)'
    );
    const highways = ['NH-44', 'NH-48', 'NH-16', 'NH-27', 'NH-8', 'NH-4', 'NH-19', 'NH-65'];
    const ids = [];
    tollCameras.forEach((cam, i) => {
        const res = insert.run(`${cam.location} Naka`, highways[i % highways.length], cam.location, cam.id);
        ids.push({ id: Number(res.lastInsertRowid), cameraId: cam.id });
    });
    return ids;
}

function seedWatchlist(plates) {
    log('Seeding watchlist...');
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    const insert = db.prepare(
        'INSERT INTO watchlist (plate_number, reason, severity, added_by, active) VALUES (?, ?, ?, ?, 1)'
    );
    const severities = ['low', 'medium', 'high', 'critical'];
    const count = 55;
    const chosen = new Set();
    const watchlisted = [];
    while (chosen.size < count) {
        chosen.add(pick(plates));
    }
    for (const plate of chosen) {
        insert.run(plate, pick(ROGUE_REASONS), pick(severities), admin.id);
        watchlisted.push(plate);
    }
    return watchlisted;
}

function seedDetectionsAndAlerts(plates, cameras, watchlisted) {
    log(`Seeding ${DETECTION_COUNT} detections...`);
    const insertDetection = db.prepare(`
        INSERT INTO detections (plate_number, camera_id, vehicle_id, confidence, captured_at, image_ref, matched)
        VALUES (?, ?, (SELECT id FROM vehicles WHERE plate_number = ?), ?, ?, ?, 1)
    `);
    const insertAlert = db.prepare(`
        INSERT INTO alerts (detection_id, watchlist_id, plate_number, camera_id, severity, status, created_at)
        VALUES (?, (SELECT id FROM watchlist WHERE plate_number = ?), ?, ?, ?, ?, ?)
    `);
    const watchlistSet = new Set(watchlisted);
    const severityByPlate = new Map();
    const watchlistRows = db.prepare('SELECT plate_number, severity FROM watchlist').all();
    for (const row of watchlistRows) severityByPlate.set(row.plate_number, row.severity);

    let alertCount = 0;
    for (let i = 0; i < DETECTION_COUNT; i++) {
        // 3% of detections are of watchlisted plates, to guarantee repeated alert history
        const plate = Math.random() < 0.03 ? pick(watchlisted) : pick(plates);
        const camera = pick(cameras);
        const confidence = +(0.82 + Math.random() * 0.179).toFixed(3);
        const capturedAt = randomDateBetween(0, 30);
        const imageRef = `/captures/${capturedAt.getFullYear()}/${plate}-${capturedAt.getTime()}.jpg`;

        const res = insertDetection.run(plate, camera.id, plate, confidence, toSqlDateTime(capturedAt), imageRef);
        const detectionId = Number(res.lastInsertRowid);

        if (watchlistSet.has(plate)) {
            const status = pick(['open', 'confirmed', 'confirmed', 'dismissed']);
            insertAlert.run(detectionId, plate, plate, camera.id, severityByPlate.get(plate) || 'medium', status, toSqlDateTime(capturedAt));
            alertCount++;
        }
    }
    log(`  ${alertCount} rogue-plate alerts generated from detections`);
}

function seedNotifications() {
    log('Seeding compliance notifications...');
    const insert = db.prepare(`
        INSERT INTO notifications (vehicle_id, type, channel, message, sent_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    // Notify owners whose insurance/permit/PUC has expired or expires within 30 days.
    const vehicles = db.prepare(`
        SELECT id, plate_number, owner_name, insurance_expiry, permit_expiry, puc_expiry FROM vehicles
    `).all();
    const today = new Date();
    let count = 0;
    for (const v of vehicles) {
        const checks = [
            ['insurance', v.insurance_expiry],
            ['permit', v.permit_expiry],
            ['puc', v.puc_expiry],
        ];
        for (const [type, expiry] of checks) {
            const expiryDate = new Date(expiry);
            const daysDiff = (expiryDate - today) / (1000 * 60 * 60 * 24);
            if (daysDiff < 30) {
                const status = daysDiff < 0 ? 'has EXPIRED' : 'expires soon';
                const message = `Dear ${v.owner_name}, the ${type} for vehicle ${v.plate_number} ${status} on ${expiry}. Please renew at the earliest to avoid penalties.`;
                const sentAt = randomDateBetween(0, 14);
                insert.run(v.id, type, pick(['sms', 'email', 'sms']), message, toSqlDateTime(sentAt));
                count++;
            }
        }
    }
    log(`  ${count} notifications sent`);
}

function seedEmergencyFleet(plates, cameras) {
    log(`Seeding ${EMERGENCY_VEHICLE_COUNT} emergency vehicles...`);
    const usedPlates = new Set(plates.slice(0, EMERGENCY_VEHICLE_COUNT));
    const insert = db.prepare(`
        INSERT INTO emergency_vehicles (vehicle_id, fleet_type, driver_name, driver_phone, driver_app_id, on_duty)
        VALUES ((SELECT id FROM vehicles WHERE plate_number = ?), ?, ?, ?, ?, ?)
    `);
    const insertEvent = db.prepare(`
        INSERT INTO green_corridor_events (emergency_vehicle_id, camera_id, signal_id, granted_at)
        VALUES (?, ?, ?, ?)
    `);
    const fleetTypes = ['ambulance', 'ambulance', 'ambulance', 'fire', 'police'];
    let evId = 0;
    let eventCount = 0;
    for (const plate of usedPlates) {
        const fleetType = fleetTypes[evId % fleetTypes.length];
        const driverName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const driverPhone = `9${randInt(100000000, 999999999)}`;
        const appId = `DRV-${pad(evId + 1, 5)}`;
        const onDuty = Math.random() < 0.35 ? 1 : 0;

        const res = insert.run(plate, fleetType, driverName, driverPhone, appId, onDuty);
        const emergencyVehicleId = Number(res.lastInsertRowid);
        evId++;

        if (onDuty) {
            const numEvents = randInt(1, 5);
            for (let j = 0; j < numEvents; j++) {
                const camera = pick(cameras);
                const grantedAt = randomDateBetween(0, 7);
                insertEvent.run(emergencyVehicleId, camera.id, `SIG-${randInt(100, 999)}`, toSqlDateTime(grantedAt));
                eventCount++;
            }
        }
    }
    log(`  ${eventCount} green corridor events generated`);
}

function seedTollTransactions(plates, tollNakas) {
    log(`Seeding ${TOLL_TRANSACTION_COUNT} toll transactions...`);
    const insert = db.prepare(`
        INSERT INTO toll_transactions (naka_id, vehicle_id, plate_number, amount, status, occurred_at)
        VALUES (?, (SELECT id FROM vehicles WHERE plate_number = ?), ?, ?, ?, ?)
    `);
    for (let i = 0; i < TOLL_TRANSACTION_COUNT; i++) {
        const naka = pick(tollNakas);
        const plate = pick(plates);
        const amount = pick([65, 85, 105, 130, 175, 220]);
        const status = Math.random() < 0.02 ? 'failed' : Math.random() < 0.03 ? 'pending' : 'reconciled';
        const occurredAt = randomDateBetween(0, 30);
        insert.run(naka.id, plate, plate, amount, status, toSqlDateTime(occurredAt));
    }
}

function run() {
    console.log('=== ANPR demo database seed ===');
    initSchema();
    resetTables();

    db.exec('BEGIN TRANSACTION');
    try {
        seedUsers();
        const plates = seedVehicles();
        const cameras = seedCameras();
        const tollNakas = seedTollNakas(cameras);
        const watchlisted = seedWatchlist(plates);
        seedDetectionsAndAlerts(plates, cameras, watchlisted);
        seedNotifications();
        seedEmergencyFleet(plates, cameras);
        seedTollTransactions(plates, tollNakas);
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    console.log('=== Seed complete ===');
    const counts = {};
    for (const t of ['users', 'vehicles', 'cameras', 'toll_nakas', 'watchlist', 'detections', 'alerts', 'notifications', 'emergency_vehicles', 'green_corridor_events', 'toll_transactions']) {
        counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    }
    console.table(counts);
}

run();
