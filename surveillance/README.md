# ANPR & Surveillance Alert System — Local Prototype

An end-to-end Automatic Number Plate Recognition and surveillance-alert prototype,
designed for testing with **physical scale-model miniature cars**.

A phone acts as an edge camera node, captures a plate, and posts the frame to a
local server. The server reads the plate with **Claude Vision** (falling back to
local **Tesseract** OCR), matches it against a mock vehicle registry, applies
business rules, and pushes the result to a control-room dashboard over
**WebSockets** — with an audible + visual alarm when a wanted vehicle appears.

```
 ┌────────────────┐   base64 frame    ┌──────────────────────────┐   WebSocket   ┌─────────────────┐
 │  Edge camera   │ ───────────────►  │      Backend server      │ ───────────►  │  Admin panel    │
 │  phone / app   │                   │  Express + ws + SQLite   │               │ React+Tailwind  │
 └────────────────┘  ◄─────────────── │                          │               └─────────────────┘
                       detection       │  Claude Vision ──┐       │
                       + owner         │                  ├─ OCR  │
                       + fines         │  Tesseract    ───┘       │
                       + alert         └──────────────────────────┘
```

---

## 1. Project structure

```
surveillance/
├── server/                     Backend — REST + WebSocket + SQLite + vision
│   ├── src/
│   │   ├── index.js            HTTP + HTTPS listeners, static hosting
│   │   ├── db/
│   │   │   ├── schema.sql      vehicles, fines, movement_logs, alerts, audit_logs
│   │   │   ├── connection.js   SQLite connection + audit() helper
│   │   │   └── seed.js         1,200 fake vehicles + demo test plates
│   │   ├── vision/
│   │   │   ├── claude.js       Claude Vision extraction (structured JSON out)
│   │   │   ├── tesseract.js    Local OCR fallback (multi-pass, Otsu threshold)
│   │   │   ├── normalize.js    Plate normalisation + fuzzy matching
│   │   │   └── pipeline.js     Hybrid orchestrator (Claude → Tesseract)
│   │   ├── routes/
│   │   │   ├── detect.js       POST /api/detect — the core pipeline
│   │   │   └── data.js         vehicles, alerts, movements, audit, stats, export
│   │   ├── ws/hub.js           WebSocket broadcast hub
│   │   └── lib/tls.js          Self-signed cert for phone camera access
│   └── public/scan.html        Browser-based edge scanner (no install needed)
│
├── admin/                      Control-room dashboard (React + Vite + Tailwind)
│   └── src/
│       ├── App.jsx             Shell, routing, WebSocket wiring, alert banner
│       ├── components/AlertBanner.jsx
│       ├── lib/useSocket.js    Auto-reconnecting WS hook + alarm tone
│       └── pages/              Dashboard · Tracking · Directory · Alerts · Audit
│
└── mobile/                     Android edge camera (React Native / Expo)
    ├── App.js
    └── src/
        ├── ConfigScreen.js     Server IP + node ID configuration
        ├── ScannerScreen.js    Live viewfinder, manual + auto capture
        └── api.js              Network dispatch layer
```

---

## 2. Run it (three commands)

Requires **Node.js 22.5+**. No database server, no Python, no native build tools.

```bash
# 1. Backend — installs deps, seeds 1,200 fake vehicles, starts on :8000
cd surveillance/server
npm install
npm run seed
npm run dev
```

```bash
# 2. Admin dashboard (second terminal) — http://localhost:5180
cd surveillance/admin
npm install
npm run dev
```

The server prints its LAN address on startup — **use that IP in the mobile app**:

```
  HTTP    http://localhost:8000
          http://192.168.1.5:8000   <- use this in the mobile app
  HTTPS   https://192.168.1.5:8443  <- browser camera on phone
```

> Building the admin panel (`cd admin && npm run build`) makes the server host it
> directly on **:8000**, so a single port serves API, dashboard, and scanner.

---

## 3. Scan from a phone — two options

### Option A — Browser scanner (works immediately, nothing to install)

1. Phone on the **same Wi-Fi** as the server.
2. Open **`https://<server-ip>:8443/scan.html`** on the phone.
3. Accept the certificate warning once (Advanced → Proceed). This is expected —
   the server generates a self-signed certificate, and browsers only permit
   camera access on a secure origin.
4. Allow camera access, aim at a plate, tap **Capture & Scan**.

### Option B — Native Android app (React Native / Expo)

```bash
cd surveillance/mobile
npm install
npx expo start
```

Scan the Expo QR code with **Expo Go** on the phone. On first launch enter the
server address (e.g. `http://192.168.1.5:8000`) and a node ID, tap **Connect**,
then use **Capture & Scan** or flip on **Auto every 2s** for continuous detection.

The native app talks plain HTTP, so it does not need the certificate step.

---

## 4. Testing with scale-model cars

The seed script creates five **simple, easy-to-hand-letter plates** — one per
business-logic branch. Write these on card and tape them to your model cars:

| Plate | Status | What should happen |
|---|---|---|
| `KL07B1234` | NORMAL | Green card: owner *Rajesh Menon*, 2 unpaid fines (₹2,000) |
| `KA01AB1111` | SURVEILLANCE | Amber card, sighting appended to the movement trail |
| `MH12CD2222` | WANTED_CRIMINAL | **Red banner + alarm tone + phone vibration** |
| `TN09XY7777` | WANTED_CRIMINAL | Same — second wanted vehicle for multi-alert testing |
| `DL03EF4444` | SURVEILLANCE | Amber, tracked across camera nodes |

**Tips for tiny plates:** fill the dashed guide box with the plate, use dark
block capitals on a light background, and keep the phone steady — the guide
region is cropped and upscaled before OCR, so filling it matters more than
overall photo resolution.

Every scanner also has a **manual plate entry** field, so you can exercise the
full business logic without a camera at all.

---

## 5. The three business-logic cases

`POST /api/detect` runs the whole pipeline and returns one JSON document:

| Status | Server behaviour | Response contains |
|---|---|---|
| **NORMAL** | Logs the sighting | Owner details, vehicle details, unpaid fines + total due |
| **SURVEILLANCE** | Appends to the movement trail, writes an audit entry | Owner details + the last 10 sightings across nodes |
| **WANTED_CRIMINAL** | Writes a `CRITICAL` alert and **broadcasts `critical_alert`** over WebSocket | Everything above plus the alert object |
| *unregistered* | Logs the sighting as unmatched | Closest registered plates by edit distance (one-tap to re-scan) |
| *no plate* | Nothing fabricated | `plate_found: false` and an explanatory message |

---

## 6. Vision pipeline

```
image ──► Claude Vision (claude-opus-5, structured JSON output)
             │  success + confidence ≥ 0.4 ──► use it
             │  failure / low confidence / no API key
             ▼
          Tesseract (3 preprocessing variants × 2 segmentation modes)
             ▼
          Positional normalisation (O↔0, I↔1, S↔5, Z↔2 by plate position)
             ▼
          Exact registry match ──► or fuzzy match (edit distance ≤ 2)
```

**Claude Vision is optional but strongly recommended.** Without a key the system
runs entirely on local Tesseract and still works — but Tesseract misreads
embossed and hand-lettered plates far more often. In testing it read a synthetic
`MH12CD2222` plate as `MH1ZCD2222`; the fuzzy matcher recovered the correct
vehicle as a one-tap suggestion, but Claude Vision reads these correctly outright.

To enable it:

```bash
cd surveillance/server
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

Restart the server — `/api/health` will report
`"vision": "claude-vision + tesseract-fallback"`.

The Claude request uses **structured outputs** so the model must return exactly:

```json
{ "plate_number": "KL07B1234", "confidence": 0.95 }
```

It also enables server-side **refusal fallbacks** (`fallbacks: "default"`), so a
declined request is automatically re-served by a fallback model rather than
failing. Any Claude error at all degrades gracefully to Tesseract.

---

## 7. Admin dashboard

| Page | Contents |
|---|---|
| **Live Dashboard** | Six KPI tiles, 14-day detection chart, busiest-nodes bars, and a live WebSocket feed of every detection as it happens |
| **Surveillance Tracking** | Flagged-vehicle list, an SVG **path map** plotting sightings by node geo-location in travel order, and a timeline |
| **Vehicle Directory** | Search/filter the registry, change any vehicle's status inline, add new fake plates, drill into fines + sighting history |
| **Alerts** | Every critical alert, filterable to unacknowledged, one-click acknowledge |
| **Audit & Export** | Full audit trail, filterable by event type, plus CSV/JSON export of all five tables |

The **alert banner** is global: a `WANTED_CRIMINAL` detection anywhere fires a
red full-width banner, a three-tone alarm via the Web Audio API, and a phone
vibration on the capturing device.

> Browsers block audio until the user interacts with the page — click anywhere in
> the dashboard once after loading and the alarm tone will play on later alerts.

---

## 8. API reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/detect` | **Core endpoint** — image or plate in, full detection result out |
| `GET` | `/api/health` | Status + which vision engine is active |
| `GET` | `/api/stats` | Dashboard aggregates |
| `GET` | `/api/vehicles` | Search / filter registry (`search`, `status`, `page`, `limit`) |
| `GET` | `/api/vehicles/:plate` | One vehicle + fines + movement history |
| `POST` | `/api/vehicles` | Add a vehicle |
| `PATCH` | `/api/vehicles/:plate/status` | Change status (NORMAL / SURVEILLANCE / WANTED_CRIMINAL) |
| `GET` | `/api/alerts` | Alert list (`acknowledged=false` for open only) |
| `PATCH` | `/api/alerts/:id/acknowledge` | Acknowledge an alert |
| `GET` | `/api/movements` | Movement logs (`plate`, `node`) |
| `GET` | `/api/surveillance/trails` | Every flagged vehicle with its full path |
| `GET` | `/api/nodes` | Camera nodes + detection counts |
| `GET` | `/api/audit` | Audit trail (`event_type`) |
| `GET` | `/api/export/:entity.csv\|json` | Export `vehicles`, `fines`, `movements`, `alerts`, `audit` |
| `WS` | `/ws` | Live events: `detection`, `critical_alert`, `registry_changed`, `alert_acknowledged` |

Quick test without any camera:

```bash
curl -X POST http://localhost:8000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"plate_number":"MH12CD2222","camera_node_id":"NODE-01"}'
```

---

## 9. Database

SQLite (`server/data/surveillance.db`) via Node's built-in `node:sqlite` — no
native compilation, so it installs cleanly on Windows without Visual Studio.

| Table | Key columns |
|---|---|
| `vehicles` | `plate_number`, `owner_name`, `vehicle_model`, `registration_date`, `status`, `status_reason` |
| `fines` | `plate_number`, `violation_type`, `amount`, `date_issued`, `paid_status` |
| `movement_logs` | `plate_number`, `camera_node_id`, `detected_at`, `snapshot_url`, `confidence` |
| `alerts` | `plate_number`, `movement_log_id`, `camera_node_id`, `severity`, `acknowledged` |
| `audit_logs` | `event_type`, `description`, `timestamp` |
| `camera_nodes` | `id`, `label`, `location`, `lat`, `lng`, `last_seen_at` |

Re-run `npm run seed` any time to reset to a fresh dataset.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Phone can't reach the server | Same Wi-Fi? Then allow the port through Windows Firewall (admin PowerShell): `netsh advfirewall firewall add rule name="ANPR" dir=in action=allow protocol=TCP localport=8000` (repeat for 8443) |
| Browser scanner shows no camera | You opened `http://`. Camera needs a secure origin — use `https://<ip>:8443/scan.html` and accept the certificate once |
| `EADDRINUSE` on start | An old server is still running. `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |
| Plate misread by a character | Expected with Tesseract — tap the suggested plate, or set `ANTHROPIC_API_KEY` to enable Claude Vision |
| No alarm sound | Click once anywhere in the dashboard; browsers block audio before a user gesture |
| Dashboard shows "Reconnecting…" | Server restarted; it reconnects automatically with backoff |
