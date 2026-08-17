import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { db, initSchema, audit } from './db/connection.js';
import { attachWebSocket, clientCount } from './ws/hub.js';
import { claudeAvailable } from './vision/claude.js';
import detectRoutes from './routes/detect.js';
import dataRoutes from './routes/data.js';
import { getTlsOptions } from './lib/tls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initSchema();
if (db.prepare('SELECT COUNT(*) c FROM vehicles').get().c === 0) {
    console.warn('[startup] Database is empty — run `npm run seed`.');
}

const app = express();
app.use(cors());
// Camera frames arrive as base64 JPEG in the JSON body.
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        vision: claudeAvailable() ? 'claude-vision + tesseract-fallback' : 'tesseract-only (no ANTHROPIC_API_KEY)',
        dashboards_connected: clientCount(),
        time: new Date().toISOString(),
    });
});

app.use('/api/detect', detectRoutes);
app.use('/api', dataRoutes);

// Serve the built admin panel if it exists, so one port serves everything.
const adminDist = path.join(__dirname, '..', '..', 'admin', 'dist');
if (existsSync(adminDist)) {
    app.use(express.static(adminDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
        res.sendFile(path.join(adminDist, 'index.html'));
    });
}

app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
});

function lanIPs() {
    const out = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const i of ifaces || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
    return out;
}

const PORT = Number(process.env.PORT) || 8000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 8443;

const httpServer = http.createServer(app);
attachWebSocket(httpServer);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ANPR Surveillance Server`);
    console.log(`  ------------------------`);
    console.log(`  HTTP    http://localhost:${PORT}`);
    for (const ip of lanIPs()) console.log(`          http://${ip}:${PORT}   <- use this in the mobile app`);
    console.log(`  Vision  ${claudeAvailable() ? 'Claude Vision (primary) + Tesseract (fallback)' : 'Tesseract only — set ANTHROPIC_API_KEY for Claude Vision'}`);
    audit('SYSTEM', 'Server started');
});

// HTTPS listener so a phone browser can use its camera (getUserMedia needs a
// secure origin off localhost). The native mobile app can use plain HTTP.
getTlsOptions()
    .then((tls) => {
        const secure = https.createServer(tls, app);
        attachWebSocket(secure);
        secure.listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`  HTTPS   https://localhost:${HTTPS_PORT}`);
            for (const ip of lanIPs()) console.log(`          https://${ip}:${HTTPS_PORT}  <- browser camera on phone`);
            console.log('');
        });
    })
    .catch((err) => console.warn('[https] disabled:', err.message));
