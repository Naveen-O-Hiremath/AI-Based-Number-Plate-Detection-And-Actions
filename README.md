# ANPR Detection & Alert System

AI-powered vehicle number plate detection & alert system — captures plates from
cameras across a road network, reads them with OCR, matches owners in a database,
and acts on policy in real time (rogue-plate alerts, insurance/expiry compliance,
emergency-vehicle green corridors, and toll integration).

> **All data in this project is synthetic.** Real vehicle-owner or government
> registry data was not available, so the database is seeded with thousands of
> fictional vehicles, owners, and events for demonstration purposes only.

## Live camera capture (real OCR, not just seeded data)

Beyond the seeded demo dataset, the console has a **Live Camera Scan** page
(`/live-scan`) that makes this a genuinely working detection pipeline, not only a
viewer over pre-generated records:

1. Open the page on a phone (or any device with a camera) and grant camera access —
   the browser's rear camera becomes a field "endpoint camera".
2. Point it at a printed or displayed plate (e.g. one from the seeded dataset, like
   `KL47UL0180`) and tap **Capture & scan**.
3. The frame is sent to the server, which runs **real OCR** (Tesseract.js, an actual
   AI text-recognition engine — no shortcuts) to read the characters, exactly the
   "Detect & read" step from the product brief.
4. The server normalizes the read (correcting common OCR digit/letter confusions
   like `O`/`0`), matches it against the vehicle registry, and — in the same request —
   runs the full policy engine: creates a rogue-plate alert if it's on the watchlist,
   raises a compliance notice if insurance/permit/PUC is expiring, and grants a green
   corridor if it matches an on-duty emergency vehicle.
5. If the OCR read doesn't exactly match anything (real cameras produce noisy reads),
   the server falls back to a fuzzy match against the registry and offers a
   "Did you mean *plate* — *owner*?" suggestion for one-tap confirmation — so an
   imperfect photo still resolves to the right vehicle.
6. Every scan — matched or not — is written to the same `detections` table as the
   seeded data, under a camera named **"Live Mobile Scanner"**, so it shows up in the
   dashboard, full logs, and vehicle history like any other capture device.

There's also a manual plate-entry field on the same page for testing the matching/
policy logic directly without a camera (useful on a desktop with no webcam, or to
confirm the pipeline before relying on OCR accuracy).

**Requires internet on first use**: Tesseract.js downloads its English-language model
(~a few MB) from its default CDN the first time OCR runs on the server, then caches it
locally for subsequent scans.

## Scanning from a mobile phone

Browsers only allow camera access on secure (HTTPS) pages, so the server also
listens on **https://&lt;your-PC-IP&gt;:4443** with a self-signed certificate it
generates on first run (`server/data/certs/`).

1. Make sure the phone is on the **same Wi-Fi** as the PC.
2. On the PC, open **Live Camera Scan** → **📱 Scan from your phone** — scan the
   QR code (or type the shown `https://…:4443/live-scan` URL on the phone).
3. The phone shows a certificate warning **once** — tap Advanced → Proceed
   (expected for a self-signed demo certificate).
4. Log in, allow camera access, aim the back camera at a plate, **Capture & scan**.
   A 🔄 Flip camera button switches front/back.

If the phone can't reach the PC at all, allow Node through Windows Firewall
(run once in an **administrator** PowerShell):

```powershell
netsh advfirewall firewall add rule name="ANPR demo HTTPS" dir=in action=allow protocol=TCP localport=4443
```

## What's in this repository

| Path | What it is |
|---|---|
| [`server/`](server) | Node/Express REST API + SQLite database + demo data seed script |
| [`client/`](client) | React admin console (the "one console to configure it all") |
| [`landing/index.html`](landing/index.html) | Standalone marketing landing page |
| [`docs/SRS.md`](docs/SRS.md) | Software Requirements Specification |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, data model, API reference |

## Quick start

Requires **Node.js 22.5+** (uses the built-in `node:sqlite` module — no native build
tools like Visual Studio required).

### 1. Server (API + database)

```bash
cd server
npm install
npm run seed    # creates server/data/anpr.db and fills it with demo data
npm run dev      # starts the API on http://localhost:4000
```

The seed script generates:

- 5,000 vehicles (owners, plates, insurance/permit/PUC expiry)
- 96 cameras (endpoint / mobile / toll), 8 toll nakas
- 55 rogue-plate watchlist entries
- 42,000 detections, ~1,700 resulting alerts
- ~9,700 compliance notifications
- 60 emergency vehicles with green-corridor event history
- 9,000 toll transactions

Re-run `npm run seed` any time to reset the database to a fresh random dataset.

### 2. Admin console (React)

In a second terminal:

```bash
cd client
npm install
npm run dev      # starts the console on http://localhost:5173
```

The Vite dev server proxies `/api` requests to the server on port 4000, so open
**http://localhost:5173** and log in with one of the seeded demo accounts:

| Email | Password | Role |
|---|---|---|
| `admin@anpr-demo.gov.in` | `admin123` | Full Access (Administrator) |
| `operator@anpr-demo.gov.in` | `operator123` | Write (Operator) |
| `viewer@anpr-demo.gov.in` | `viewer123` | Reader (Viewer) |

### 3. Landing page

`landing/index.html` is a standalone file with no build step — open it directly in
a browser, or serve the folder with any static file server.

### 4. Production build

```bash
cd client
npm run build     # outputs client/dist
```

If `client/dist` exists, the Express server (`server/src/index.js`) serves it
directly alongside the API, so `npm start` in `server/` alone is enough to run the
whole console from a single process/port in production.

## Documentation

- **[Software Requirements Specification](docs/SRS.md)** — functional & non-functional
  requirements, permission matrix, traceability to code.
- **[Architecture](docs/ARCHITECTURE.md)** — component diagram, detection-to-action
  sequence, data model (ERD), full API reference, deployment view, and the
  production-scale path beyond this reference build.

## Notes on the reference implementation

- **Database**: SQLite via Node's built-in `node:sqlite`, chosen specifically to
  avoid requiring native compilation (`better-sqlite3` needs Visual Studio Build
  Tools on Windows, which may not be present). See ARCHITECTURE.md §3 for the
  PostgreSQL migration path for production scale.
- **Auth**: JWT bearer tokens (12h expiry), bcrypt-hashed passwords, role checks
  enforced server-side on every mutating endpoint.
- **AI daily summary**: templated from the same aggregate SQL queries the dashboard
  uses, so the demo works fully offline with no external LLM call — the format
  mirrors what an LLM-generated digest would produce from the day's logs.
