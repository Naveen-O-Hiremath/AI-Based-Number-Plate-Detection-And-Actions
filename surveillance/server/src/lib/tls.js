import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '..', '..', 'data', 'certs');

function lanIPs() {
    const out = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const i of ifaces || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
    return out;
}

/**
 * Self-signed cert so a phone browser on the LAN gets a secure origin (required
 * for getUserMedia). The native app talks plain HTTP and does not need this.
 */
export async function getTlsOptions() {
    if (!existsSync(certDir)) mkdirSync(certDir, { recursive: true });
    const keyPath = path.join(certDir, 'server.key');
    const certPath = path.join(certDir, 'server.crt');

    if (!existsSync(keyPath) || !existsSync(certPath)) {
        let selfsigned;
        try {
            selfsigned = (await import('selfsigned')).default;
        } catch {
            throw new Error('optional dependency `selfsigned` not installed — HTTPS listener skipped');
        }
        const pems = await selfsigned.generate([{ name: 'commonName', value: 'anpr-surveillance.local' }], {
            days: 3650,
            keySize: 2048,
            extensions: [{
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' },
                    ...lanIPs().map((ip) => ({ type: 7, ip })),
                ],
            }],
        });
        writeFileSync(keyPath, pems.private);
        writeFileSync(certPath, pems.cert);
        console.log(`[https] generated self-signed certificate in ${certDir}`);
    }
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}
