import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '..', '..', 'data', 'certs');

// Browsers only allow camera (getUserMedia) on secure origins. localhost is
// exempt, but a phone reaching this server over Wi-Fi is not — so we serve
// HTTPS with a self-signed cert generated on first run. The phone shows a
// one-time certificate warning; accepting it is fine for a LAN demo.
export async function getTlsOptions() {
    if (!existsSync(certDir)) mkdirSync(certDir, { recursive: true });
    const keyPath = path.join(certDir, 'server.key');
    const certPath = path.join(certDir, 'server.crt');

    if (!existsSync(keyPath) || !existsSync(certPath)) {
        const ips = getLanIPs();
        const pems = await selfsigned.generate(
            [{ name: 'commonName', value: 'anpr-demo.local' }],
            {
                days: 3650,
                keySize: 2048,
                extensions: [{
                    name: 'subjectAltName',
                    altNames: [
                        { type: 2, value: 'localhost' },
                        { type: 7, ip: '127.0.0.1' },
                        ...ips.map((ip) => ({ type: 7, ip })),
                    ],
                }],
            }
        );
        writeFileSync(keyPath, pems.private);
        writeFileSync(certPath, pems.cert);
        console.log(`[https] Generated self-signed certificate in ${certDir}`);
    }

    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

export function getLanIPs() {
    const ips = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces || []) {
            if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
        }
    }
    return ips;
}
