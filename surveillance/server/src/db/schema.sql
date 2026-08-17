-- ANPR Surveillance & Alert System — relational schema

-- Vehicles & owners. `status` drives the three business-logic cases.
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL UNIQUE,
    owner_name TEXT NOT NULL,
    owner_phone TEXT,
    owner_address TEXT,
    vehicle_model TEXT NOT NULL,
    vehicle_color TEXT,
    registration_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NORMAL'
        CHECK (status IN ('NORMAL', 'SURVEILLANCE', 'WANTED_CRIMINAL')),
    status_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

-- Traffic fines / infringements.
CREATE TABLE IF NOT EXISTS fines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    amount REAL NOT NULL,
    date_issued TEXT NOT NULL,
    paid_status TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK (paid_status IN ('PAID', 'UNPAID')),
    FOREIGN KEY (plate_number) REFERENCES vehicles(plate_number)
);
CREATE INDEX IF NOT EXISTS idx_fines_plate ON fines(plate_number);
CREATE INDEX IF NOT EXISTS idx_fines_paid ON fines(paid_status);

-- Camera nodes (edge devices: phones, fixed cameras).
CREATE TABLE IF NOT EXISTS camera_nodes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    location TEXT NOT NULL,
    lat REAL,
    lng REAL,
    last_seen_at TEXT
);

-- Every detection becomes a movement log row — the surveillance trail.
CREATE TABLE IF NOT EXISTS movement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    camera_node_id TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    snapshot_url TEXT,
    confidence REAL,
    vision_source TEXT,
    matched INTEGER NOT NULL DEFAULT 0,
    status_at_detection TEXT
);
CREATE INDEX IF NOT EXISTS idx_movement_plate ON movement_logs(plate_number);
CREATE INDEX IF NOT EXISTS idx_movement_time ON movement_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_movement_node ON movement_logs(camera_node_id);

-- High-priority alerts raised for WANTED_CRIMINAL hits (and manual escalations).
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    movement_log_id INTEGER REFERENCES movement_logs(id),
    camera_node_id TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'CRITICAL',
    message TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged);

-- System audit trail — every meaningful event.
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
