# Software Requirements Specification

## AI-Powered Vehicle Number Plate Information Detection & Alert System (ANPR)

Version 1.0 — 18 July 2026

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the ANPR
Detection & Alert System — a platform that captures vehicle number plates from cameras
across a road network, reads the registration number using AI-based OCR, retrieves the
owner's information from a central vehicle database, and automatically takes actions
based on policies configured by an administrator.

It is intended for engineering, QA, and product stakeholders who need a shared
reference for what the system does, who can do what, and how the pieces fit together.

### 1.2 Scope

The system covers:

- Ingestion of plate images from fixed (endpoint), mobile, and toll-naka cameras.
- AI/OCR-based plate detection and reading, day and night.
- Owner/vehicle lookup against a central registry.
- Four policy modules: rogue/criminal plate alerts, insurance & document compliance
  notifications, emergency vehicle green corridor, and toll naka integration.
- A web-based admin console with three role tiers (Full Access / Write / Reader).
- An AI-generated daily activity digest and full searchable event logs.

Out of scope for this specification: the physical camera hardware, the signal
controller hardware integration protocol, and payment gateway integration for toll
settlement (the system emits reconciliation records; it does not process payments).

### 1.3 Definitions, Acronyms, Abbreviations

| Term | Meaning |
|---|---|
| ANPR | Automatic Number Plate Recognition |
| OCR | Optical Character Recognition |
| Naka | A toll checkpoint / barrier on a highway (regional term used in the brief) |
| RTO | Regional Transport Office (vehicle registration authority) |
| PUC | Pollution Under Control certificate |
| Green corridor | A route where traffic signals are pre-emptively cleared for an emergency vehicle |
| RBAC | Role-Based Access Control |

### 1.4 Reference Implementation

A working reference implementation accompanies this specification in the same
repository (`/server`, `/client`, `/landing`), seeded with several thousand synthetic
vehicle, detection, and transaction records. **All plate numbers, owner names, and
addresses in that dataset are fictional**, generated locally — no government or
real-world registry data is used anywhere in this project.

The reference implementation also includes a genuinely working capture path (not only
a viewer over the seeded data): the admin console's **Live Camera Scan** page uses a
device's camera to capture a real frame, sends it to the server, and runs an actual
OCR engine (Tesseract.js) against it — so pointing a phone at a printed plate from the
seeded dataset triggers real detection, matching, and policy evaluation end to end.
See FR-CAP-6 and §7.3.

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a new, self-contained platform, not a modification of an existing one.
It is composed of four cooperating parts:

1. **Field devices** — endpoint cameras, mobile/patrol cameras, and a driver duty app.
2. **Central server** — ingests captures, runs detection/OCR, matches owners, evaluates
   policies, and stores all state.
3. **Policy engine** — the rule layer inside the central server that decides what
   action a match should trigger (alert, notify, grant signal priority, reconcile toll).
4. **Admin console** — the web UI where administrators configure policy and review
   activity.

### 2.2 User Classes and Characteristics

| Role | Console access level | Typical user |
|---|---|---|
| Administrator | Full Access | Traffic police IT admin, control-room supervisor |
| Operator | Write | Control-room duty officer, watchlist analyst |
| Viewer | Reader | Auditor, field supervisor, read-only stakeholder |

See §4 for the precise permission matrix.

### 2.3 Operating Environment

- Central server: any environment capable of running a Node.js HTTP service; scales
  horizontally behind a load balancer for production deployments (see ARCHITECTURE.md).
- Admin console: any evergreen desktop browser (Chrome, Edge, Firefox).
- Field devices: network-connected cameras/handhelds capable of streaming JPEG frames
  or short clips to the ingestion endpoint over HTTPS.

### 2.4 Assumptions and Constraints

- Plate formats follow the Indian standard (state code + RTO code + series + number);
  the OCR/matching logic assumes this format but is not architecturally tied to it.
- The driver duty app is treated as a trusted, authenticated client of the central
  server; its own UI/UX is out of scope here beyond the duty-mode toggle contract.
- Network connectivity between field devices and the central server is assumed to be
  intermittent-tolerant (devices queue and retry on reconnect) — full offline capture
  buffering is a non-functional target, not detailed at the protocol level here.

---

## 3. Functional Requirements

Requirement IDs are grouped by module for traceability (`FR-<MODULE>-<n>`).

### 3.1 Capture & Detection (FR-CAP)

| ID | Requirement |
|---|---|
| FR-CAP-1 | The system shall accept image/frame uploads from endpoint cameras, mobile cameras, and other registered capture devices. |
| FR-CAP-2 | The system shall locate the number plate region within a captured frame using an AI detection model. |
| FR-CAP-3 | The system shall read the plate characters via OCR under both daytime and low-light/nighttime conditions. |
| FR-CAP-4 | The system shall record, for every detection, the source camera, timestamp, confidence score, and a reference to the captured image. |
| FR-CAP-5 | The system shall function when a camera is designated as `endpoint`, `mobile`, or `toll` type, without requiring different ingestion contracts. |
| FR-CAP-6 | The admin console shall provide a live capture mode where a device's own camera acts as a mobile endpoint: it captures a frame, the server runs OCR against it, and the result is matched and policy-checked in the same request. |
| FR-CAP-7 | When an OCR read does not exactly match a registered plate, the system shall suggest the closest registered plate(s) by edit distance, rather than silently failing to match. |

### 3.2 Owner Matching (FR-MATCH)

| ID | Requirement |
|---|---|
| FR-MATCH-1 | The system shall match a read plate number against the vehicle registry and retrieve owner name, contact, address, and vehicle details. |
| FR-MATCH-2 | The system shall flag a detection as unmatched if the plate number does not exist in the registry, without discarding the detection record. |
| FR-MATCH-3 | The admin console shall provide a plate/owner search with partial match on plate number or owner name. |

### 3.3 Rogue / Criminal Plate Alerts (FR-ROGUE)

| ID | Requirement |
|---|---|
| FR-ROGUE-1 | An Operator or Administrator shall be able to add a plate number to a watchlist with a reason and severity level (low/medium/high/critical). |
| FR-ROGUE-2 | Whenever any camera detects a plate present on the active watchlist, the system shall generate an alert within the same processing pass as the detection (no separate batch job). |
| FR-ROGUE-3 | Each alert shall capture the triggering detection (image reference, camera, timestamp) as evidence. |
| FR-ROGUE-4 | An Operator or Administrator shall be able to set an alert's status to Open, Confirmed, or Dismissed. |
| FR-ROGUE-5 | An Operator or Administrator shall be able to deactivate a watchlist entry without deleting its history. |

### 3.4 Compliance & Notifications (FR-COMP)

| ID | Requirement |
|---|---|
| FR-COMP-1 | The system shall track insurance expiry, permit/registration expiry, and PUC expiry per vehicle. |
| FR-COMP-2 | The system shall automatically generate a notification to the owner when a tracked document has expired or will expire within a configurable window (default 30 days). |
| FR-COMP-3 | The admin console shall display aggregate compliance statistics (counts by document type, vehicles expiring soon) and a searchable notification history. |

### 3.5 Green Corridor / Emergency Vehicles (FR-EMRG)

| ID | Requirement |
|---|---|
| FR-EMRG-1 | An Operator or Administrator shall be able to register a vehicle as an emergency vehicle (ambulance, fire, or police) with a linked driver and driver-app identifier. |
| FR-EMRG-2 | A registered driver shall be able to toggle duty mode on/off via the companion app; the server shall record the resulting on/off state. |
| FR-EMRG-3 | While a registered emergency vehicle is on duty and detected by a camera, the system shall grant a green-corridor signal event and log it (camera, signal ID, timestamp). |
| FR-EMRG-4 | The admin console shall list the registered fleet with current duty status and corridor-grant history. |

### 3.6 Toll Integration (FR-TOLL)

| ID | Requirement |
|---|---|
| FR-TOLL-1 | The same detection pipeline shall operate at toll-naka cameras, identifying vehicles at the barrier. |
| FR-TOLL-2 | The system shall record a toll transaction per identified vehicle per naka, including amount and reconciliation status (reconciled/pending/failed). |
| FR-TOLL-3 | The admin console shall provide per-naka transaction totals and a filterable transaction log. |
| FR-TOLL-4 | Every policy check available elsewhere in the system (rogue watchlist, compliance) shall also apply at the naka. |

### 3.7 Admin Console (FR-ADMIN)

| ID | Requirement |
|---|---|
| FR-ADMIN-1 | The console shall present a dashboard summarizing total detections, open alerts, compliance notices, on-duty emergency vehicles, and toll throughput. |
| FR-ADMIN-2 | The console shall generate an AI-style daily digest summarizing the previous day's detections, alerts, notifications, corridors granted, and toll activity. |
| FR-ADMIN-3 | The console shall provide a unified, searchable log across detections, alerts, notifications, toll transactions, and corridor events. |
| FR-ADMIN-4 | An Administrator shall be able to create, change the role of, and remove console user accounts. |

### 3.8 Access Control (FR-ACL)

| ID | Requirement |
|---|---|
| FR-ACL-1 | The system shall authenticate console users and issue a session credential (token) valid for a bounded time window. |
| FR-ACL-2 | The system shall enforce three access levels — Administrator (Full Access), Operator (Write), Viewer (Reader) — on every state-changing endpoint. |
| FR-ACL-3 | A Viewer shall be able to read all dashboards, summaries, and logs but shall be rejected (HTTP 403) on any create/update/delete action. |
| FR-ACL-4 | Only an Administrator shall be able to manage other users' accounts and roles. |

---

## 4. Permission Matrix

| Action | Administrator | Operator | Viewer |
|---|:---:|:---:|:---:|
| View dashboards, AI summaries, logs | ✓ | ✓ | ✓ |
| Search vehicles / view owner details | ✓ | ✓ | ✓ |
| Add / deactivate watchlist entries | ✓ | ✓ | ✕ |
| Change alert status | ✓ | ✓ | ✕ |
| Register emergency vehicles, toggle duty | ✓ | ✓ | ✕ |
| Configure policies & devices | ✓ | ✓ | ✕ |
| Manage console users & roles | ✓ | ✕ | ✕ |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Plate-to-owner lookup shall complete in under 1 second per detection under nominal load. |
| NFR-2 | Availability | Detection ingestion and alerting shall operate 24×7 with no scheduled downtime for read paths. |
| NFR-3 | Scalability | The system shall handle detection volumes proportional to a metro-scale camera network (tens of thousands of detections/day) without architectural change; see ARCHITECTURE.md for the horizontal-scaling path. |
| NFR-4 | Security | Passwords shall be stored hashed (never plaintext); all console API calls shall require a valid bearer token; role checks shall be enforced server-side, not solely in the UI. |
| NFR-5 | Auditability | Every alert, notification, watchlist change, and corridor grant shall be retained with a timestamp and be visible in the searchable log. |
| NFR-6 | Data privacy | Demo/test environments shall use synthetic data only; production deployments are responsible for complying with applicable vehicle-registry and personal-data regulations. |
| NFR-7 | Usability | The admin console shall present severity/status as both color and text (not color alone), for accessibility. |
| NFR-8 | Portability | The reference server shall run on commodity Node.js without requiring a compiled native database driver, to simplify deployment. |

---

## 6. External Interface Requirements

### 6.1 Admin Console API (summary)

The reference implementation exposes a REST API under `/api`; see `ARCHITECTURE.md`
§5 for the full endpoint list. All endpoints except `/api/auth/login` require an
`Authorization: Bearer <token>` header.

### 6.2 Data Requirements (summary)

Core entities: `vehicles`, `watchlist`, `cameras`, `toll_nakas`, `detections`,
`alerts`, `notifications`, `emergency_vehicles`, `green_corridor_events`,
`toll_transactions`, `users`. Full schema in `server/src/db/schema.sql`.

---

## 7. Appendix

### 7.1 Demo Data Disclaimer

Real vehicle-owner and government registry data was not available for this project.
The accompanying reference implementation seeds its database with **5,000+ synthetic
vehicles, 42,000+ synthetic detections, and thousands of synthetic compliance/toll
records**, generated from name and location lists with no connection to any real
person, vehicle, or registry. This dataset exists solely to demonstrate the system's
behavior end-to-end.

### 7.2 Traceability

Each functional requirement above maps to a route/module in the reference server:

| Requirement group | Server module |
|---|---|
| FR-CAP, FR-MATCH | `routes/detections.js`, `routes/vehicles.js` |
| FR-ROGUE | `routes/watchlist.js`, `routes/alerts.js` |
| FR-COMP | `routes/compliance.js` |
| FR-EMRG | `routes/emergency.js` |
| FR-TOLL | `routes/toll.js` |
| FR-ADMIN | `routes/dashboard.js`, `routes/summary.js`, `routes/logs.js` |
| FR-ACL | `middleware/auth.js`, `routes/users.js` |
| FR-CAP-6, FR-CAP-7 | `routes/scan.js`, `ocr/worker.js`, `ocr/plateNormalizer.js` |

### 7.3 Live Capture Implementation Notes

- OCR engine: **Tesseract.js**, running server-side in Node (no native compilation
  required, consistent with the rest of the reference stack). The first OCR call
  downloads its English-language model and caches it locally for subsequent scans.
- Plate normalization corrects common OCR digit/letter confusions (`O`↔`0`, `I`↔`1`,
  `S`↔`5`, `B`↔`8`, etc.) using the known positional structure of an Indian plate.
- When no exact registry match is found, a Levenshtein-distance fuzzy match against
  all registered plates surfaces near-matches (distance ≤ 2) as suggestions — this
  satisfies FR-CAP-7 and keeps a noisy real-world photo from being a dead end.
- Every live scan (matched or not) is persisted as a `detections` row under a
  dedicated camera named "Live Mobile Scanner", so it is indistinguishable from any
  other capture device in the logs, dashboard, and vehicle history.
