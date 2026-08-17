import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'surveillance.db'));
db.exec('PRAGMA journal_mode = WAL;');

export function initSchema() {
    db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));
}

export function audit(eventType, description) {
    db.prepare(
        "INSERT INTO audit_logs (event_type, description, timestamp) VALUES (?, ?, datetime('now'))"
    ).run(eventType, description);
}
