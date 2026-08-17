import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import https from 'node:https';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTlsOptions, getLanIPs } from './lib/https.js';

import { initSchema, isEmpty } from './db/connection.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import watchlistRoutes from './routes/watchlist.js';
import alertRoutes from './routes/alerts.js';
import cameraRoutes from './routes/cameras.js';
import detectionRoutes from './routes/detections.js';
import complianceRoutes from './routes/compliance.js';
import emergencyRoutes from './routes/emergency.js';
import tollRoutes from './routes/toll.js';
import summaryRoutes from './routes/summary.js';
import logRoutes from './routes/logs.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import scanRoutes from './routes/scan.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initSchema();
if (isEmpty()) {
    console.warn('[startup] Database is empty. Run `npm run seed` to generate demo data.');
}

const app = express();
app.use(cors());
// Captured camera frames arrive as base64 JPEG in the JSON body — a single
// frame can run a few hundred KB to a couple of MB depending on resolution.
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', requireAuth, vehicleRoutes);
app.use('/api/watchlist', requireAuth, watchlistRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/cameras', requireAuth, cameraRoutes);
app.use('/api/detections', requireAuth, detectionRoutes);
app.use('/api/compliance', requireAuth, complianceRoutes);
app.use('/api/emergency-vehicles', requireAuth, emergencyRoutes);
app.use('/api/toll', requireAuth, tollRoutes);
app.use('/api/summary', requireAuth, summaryRoutes);
app.use('/api/logs', requireAuth, logRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/scan', requireAuth, scanRoutes);
app.use('/api/export', requireAuth, exportRoutes);
app.use('/api/import', requireAuth, importRoutes);

// Serve the built React admin console in production, if present.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`ANPR API server listening on http://localhost:${PORT}`);
});

// HTTPS listener so phones on the same Wi-Fi can use their camera — browsers
// block getUserMedia on plain http:// for non-localhost origins.
const HTTPS_PORT = process.env.HTTPS_PORT || 4443;
getTlsOptions()
    .then((tls) => {
        https.createServer(tls, app).listen(HTTPS_PORT, () => {
            console.log(`ANPR HTTPS listening on https://localhost:${HTTPS_PORT}`);
            for (const ip of getLanIPs()) {
                console.log(`  → phone on same Wi-Fi: https://${ip}:${HTTPS_PORT}  (accept the certificate warning once)`);
            }
        });
    })
    .catch((err) => {
        console.error('[https] Could not start HTTPS listener:', err.message);
    });
