-- ANPR Detection System — SQLite schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL UNIQUE,
    owner_name TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    registration_date TEXT NOT NULL,
    insurance_expiry TEXT NOT NULL,
    permit_expiry TEXT NOT NULL,
    puc_expiry TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);

CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    added_by INTEGER REFERENCES users(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_watchlist_plate ON watchlist(plate_number);

CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('endpoint', 'mobile', 'toll')),
    location TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance'))
);

CREATE TABLE IF NOT EXISTS toll_nakas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    highway TEXT NOT NULL,
    location TEXT NOT NULL,
    camera_id INTEGER REFERENCES cameras(id)
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    camera_id INTEGER NOT NULL REFERENCES cameras(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    confidence REAL NOT NULL,
    captured_at TEXT NOT NULL,
    image_ref TEXT NOT NULL,
    matched INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_detections_plate ON detections(plate_number);
CREATE INDEX IF NOT EXISTS idx_detections_time ON detections(captured_at);
CREATE INDEX IF NOT EXISTS idx_detections_camera ON detections(camera_id);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL REFERENCES detections(id),
    watchlist_id INTEGER REFERENCES watchlist(id),
    plate_number TEXT NOT NULL,
    camera_id INTEGER NOT NULL REFERENCES cameras(id),
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed')),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    type TEXT NOT NULL CHECK (type IN ('insurance', 'permit', 'puc')),
    channel TEXT NOT NULL DEFAULT 'sms',
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_vehicle ON notifications(vehicle_id);

CREATE TABLE IF NOT EXISTS emergency_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    fleet_type TEXT NOT NULL CHECK (fleet_type IN ('ambulance', 'fire', 'police')),
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    driver_app_id TEXT NOT NULL UNIQUE,
    on_duty INTEGER NOT NULL DEFAULT 0,
    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS green_corridor_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emergency_vehicle_id INTEGER NOT NULL REFERENCES emergency_vehicles(id),
    camera_id INTEGER NOT NULL REFERENCES cameras(id),
    signal_id TEXT NOT NULL,
    granted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS toll_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naka_id INTEGER NOT NULL REFERENCES toll_nakas(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    plate_number TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'reconciled' CHECK (status IN ('reconciled', 'pending', 'failed')),
    occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_toll_time ON toll_transactions(occurred_at);
