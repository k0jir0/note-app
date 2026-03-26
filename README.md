# Note App

A full-stack note-taking, applied security-research, and browser-automation application built with Node.js, Express, MongoDB, and EJS. Alongside encrypted notes, it includes dedicated Security, ML, Mission Assurance, Hardware-First MFA, Session Management, Injection Prevention, XSS Defense, Access Control, Playwright, Selenium, and Self-Healing modules across a unified Research Workspace.

## Features

- Accounts and notes: local signup/login with Passport and bcrypt, optional Google sign-in with email-based account linking, encrypted note CRUD, and per-user authorization.
- Core web security: input validation, Mongo-oriented injection prevention, strict CSP-backed XSS defense, session-backed CSRF protection, MongoDB-backed sessions, Helmet headers, and route-specific rate limiting.
- Security research workflow: server-side log analysis, scan import from Nmap/Nikto/JSON, alert-to-scan correlation, and a unified Research Workspace for security architecture, automation, and browser-testing tools.
- ML and response: an ML Module for training and inspecting the alert-triage model, explainable scoring, feedback-aware supervision, autonomy proof flows, and an auditable notify-or-block policy for high-risk ingested alerts.
- Mission-grade assurance: dedicated modules for RBAC-plus-ABAC mission access decisions, hardware-first MFA and PKI step-up, strict session timeout and concurrent-login control, and server-side access-control verification for protected APIs.
- Browser automation: Playwright and Selenium modules for scenario planning, latest-run artifact reporting, and generated test templates, plus a Self-Healing Module at `/self-healing/module` that ranks locator repairs from a broken selector, a step goal, and a DOM snippet.
- Optional automation and realtime: scheduled ingestion for logs, scans, and intrusion events; Falco and Trivy runners; Redis-backed live ingest and streaming; Slack or SMTP notifications; and `/metrics` instrumentation for automation and scan activity.
- Delivery and quality: a REST API, responsive Bootstrap UI, CI-friendly smoke and integration coverage, report-only Trivy CI artifacts for triage, and end-to-end testing with Mocha, Chai, Sinon, Playwright, and Selenium across notes, auth, security, ML, mission assurance, MFA, session management, the web-security modules, browser modules, self-healing, and autonomy-demo flows.

## Tech Stack

**Backend:** Node.js, Express 5.2, MongoDB 8.10 (Mongoose), Passport.js, bcrypt, express-session, connect-mongo, helmet  
**Frontend:** EJS 5.0, Bootstrap 5.3, Vanilla JS  
**Testing:** Mocha, Chai, Sinon, Playwright, Selenium WebDriver, ESLint

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account or local MongoDB
- npm

### Setup

1. **Clone & Install**
```bash
git clone https://github.com/k0jir0/note-app.git
cd note-app
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
cp .env.local.example .env.local  # optional local-only overrides
```

Edit `.env` for shared local settings:
```env
MONGODB_URI=<your-mongodb-connection-string>
SESSION_SECRET=your-strong-random-secret-32-chars-minimum
NOTE_ENCRYPTION_KEY=64-char-hex-key-for-note-encryption
NODE_ENV=development
PORT=3000
```

If you want Google sign-in locally, put workstation-only values in `.env.local` instead of `.env`:
```env
APP_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Generate strong local secrets with Node:
```bash
node -e "const crypto=require('crypto'); console.log('SESSION_SECRET=' + crypto.randomBytes(48).toString('hex')); console.log('NOTE_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));"
```

**MongoDB Setup:**
- MongoDB Atlas: Create a free cluster, copy connection string
- Local MongoDB: Use `mongodb://localhost:27017/noteApp`

3. **Run**
```bash
npm run start-dev  # Development
npm start          # Production
npm test           # Run tests
npm run test:selenium # Run Selenium browser tests against a live local app
npm run test:e2e   # Run Playwright browser tests in Chromium
npm run lint       # ESLint
```

Server: `http://localhost:3000`

For a more stable Windows local launch, prefer the included launcher instead of a transient shell session:
```powershell
.\run-local.ps1
.\run-local.ps1 -WithWorker
```

Playwright browser setup:
```bash
npx playwright install
npm run test:e2e
npm run test:e2e:all
```

Notes:
- Playwright tests assume the app is already running on `http://localhost:3000` unless `PLAYWRIGHT_BASE_URL` is set.
- `npm run test:e2e` refreshes `artifacts/playwright-results.json`, which powers the latest-run badges on `/playwright/module`.
- `npm run test:e2e` runs the registered Playwright browser suite in Chromium; `npm run test:e2e:all` runs that same suite across Chromium, Firefox, and WebKit.
- `npm run test:selenium` assumes the app is reachable on `http://localhost:3000` unless `SELENIUM_BASE_URL` is set, defaults to a headless Edge session (`SELENIUM_BROWSER=chrome` is also supported), and refreshes `artifacts/selenium-results.json` for the Selenium Module page.
- `npm run locator-repair:train` refreshes the persisted self-healing reranker artifact at `artifacts/locator-repair-model.json`.

Notes:
- `.env.local` is gitignored and overrides `.env` at startup, which makes it the safest place for machine-specific OAuth credentials.
- Local Google OAuth is intentionally normalized to `http://localhost:3000`; if you browse from `127.0.0.1`, the app redirects you to the canonical localhost URL before starting Google sign-in.

Current local verification (March 26, 2026):
- `npm test` passes with 461 tests
- `npm run lint` passes with 0 errors
- Live app checks on `http://localhost:3000` confirm the current protected module routes are mounted
- Latest `artifacts/playwright-results.json` on disk shows 13 expected / 0 unexpected in Chromium
- Latest `artifacts/selenium-results.json` on disk shows 11 passing / 0 failing

4. **Create Account & Use**
- Navigate to `/auth/signup` to create an account
- Login and start creating notes
- Use `/research` to access the unified Research Workspace for Security, ML, Mission Assurance, Hardware-First MFA, Session Management, Injection Prevention, XSS Defense, Access Control, Playwright, Selenium, and Self-Healing
- Use the Security Module link inside `/research` to run `Inject Automation Sample` and populate Alerts, Scans, and Correlations with demo data for the signed-in account
- Use `/ml/module` to inspect the active alert-triage model, compare score provenance and score distributions, review learned feature influence, train either a bootstrap or hybrid model, and verify autonomous-response behavior with the built-in demo flow
- Use `/mission-assurance/module`, `/hardware-mfa/module`, and `/session-management/module` to inspect mission-role policy decisions, strong-factor step-up posture, and abandoned-terminal lockdown behavior
- Use `/injection-prevention/module`, `/xss-defense/module`, and `/access-control/module` to inspect the app's architectural handling of injection prevention, XSS defense, and server-side access verification
- Use `/playwright/module` to inspect browser-test scenarios, review the latest annotated Playwright run, and export Playwright specs for the auth, notes, research, security, Playwright, and Selenium flows
- Use `/selenium/module` to inspect browser-test scenarios, review Selenium prerequisites, and export WebDriver smoke templates for the Research, Security, ML, and Selenium module flows
- Use `/self-healing/module` to open the Self-Healing Module, analyze broken Playwright and Selenium locators, load sample failure cases, and compare ranked repair suggestions before editing the test
- Optional: send a `POST` request to `/seed` after logging in (dev only) for sample data

### Optional Automation

The shortest path to self-sufficient research workflows is built in as three pollers:

- Log batch ingestion tails one configured log file, analyzes only new appended content, and creates deduplicated alerts.
- Scan batch ingestion polls one configured scan output file, imports it when the content changes, and stores a fingerprint to avoid duplicate imports.
- Intrusion batch ingestion polls one Falco-style JSON lines file, normalizes events into saved alerts, and deduplicates by content fingerprint.
- Correlations do not need a separate job because they are derived from the saved alerts and scans whenever the dashboard loads.

Example configuration:

```env
LOG_BATCH_ENABLED=true
LOG_BATCH_FILE_PATH=C:\logs\app.log
LOG_BATCH_USER_ID=<mongo-user-id>
LOG_BATCH_INTERVAL_MS=60000

SCAN_BATCH_ENABLED=true
SCAN_BATCH_FILE_PATH=C:\scans\latest-nmap.xml
SCAN_BATCH_USER_ID=<mongo-user-id>
SCAN_BATCH_INTERVAL_MS=300000

INTRUSION_BATCH_ENABLED=true
INTRUSION_BATCH_FILE_PATH=C:\logs\falco-output.log
INTRUSION_BATCH_USER_ID=<mongo-user-id>
INTRUSION_BATCH_INTERVAL_MS=5000
```

This is intentionally minimal: point the app at a live log file and a scanner output file that gets refreshed by some external job, and the Research pages begin updating themselves.

### Optional Realtime Alerts

Realtime APIs are mounted by default, but they only become active when Redis is configured and realtime is enabled.

Required environment:

```env
REDIS_URL=redis://127.0.0.1:6379
ENABLE_REALTIME=1
```

Then start the app and the worker in separate shells:

```bash
npm run start-dev
npm run worker
```

Notes:
- The web app uses `MONGODB_URI` and the worker now does the same, with `MONGO_URI` accepted only as a compatibility fallback.
- The worker loads both `.env` and `.env.local`, so local Redis and OAuth-related overrides are available there too.
- In development, `POST /api/runtime/realtime` can toggle realtime on or off at runtime, but Redis still needs to be configured first.
- The Security Module page now shows two realtime states: a server badge for feature availability and a browser badge for the current tab's live stream state.
- `Disconnect Realtime` only closes the current browser tab's SSE stream; it does not disable realtime globally on the server.

### Security Module Demo Sample

The Research Workspace links to a dedicated Security Module page with an `Inject Automation Sample` action.

- It writes demo alert and scan records for the currently authenticated user.
- The sample currently creates visible alert types for failed-login burst, suspicious path probing, scanner-tool detection, injection attempt, and directory enumeration.
- After completion, the workspace refreshes the Alerts, Scans, and Correlations panels so the saved records appear immediately.
- If backend sample behavior changes, restart the app and reload the Research page so both server and browser assets are current.

### ML Module Overview

The Research Workspace links to a dedicated ML Module page at `/ml/module`.

- The page acts as a compact model-operations surface for the alert-triage system rather than a single training button.
- It ties together the full triage loop: label supply, model fitting, runtime model state, explainability, scored-alert inspection, and the downstream autonomy audit trail.
- `Train Bootstrap Model` fits a synthetic-first logistic-regression model for cold-start demos and sparse-label environments.
- `Train Hybrid Model` mixes project-wide analyst labels with synthetic examples when real coverage is still limited.
- The dashboard visualizes feedback supply, score-label counts, score-source counts, score buckets, per-alert-type priority breakdowns, and the strongest positive and negative learned feature weights so the model can be inspected rather than simply trusted.
- `Autonomy Demo Inject` seeds a safe dry-run notify-plus-block scenario and should increase the ML Module's `Observed Autonomous Outcomes` counters, making it easy to prove that the policy loop is recording decisions on stored alerts.

### Playwright Module Overview

The Research Workspace also links to a dedicated Playwright Module page at `/playwright/module`.

- The page acts as a browser-coverage dashboard and spec-generator for the authenticated app's Playwright suite.
- It exposes scenario metadata for auth, notes, Research Workspace navigation, Security Module flows, and the Playwright and Selenium module pages themselves.
- The module reads `artifacts/playwright-results.json` and maps annotated browser tests onto scenario cards so the UI can show the latest run status instead of a static placeholder.
- Generated specs are intentionally smoke-test oriented: they focus on stable routes, headings, and core module controls rather than brittle low-level DOM selectors.
- The latest verified Chromium artifact covers 13 registered Playwright scenarios, and the page refreshes to reflect the most recent report on disk.

### Self-Healing Module Overview

The Research Workspace also links to a dedicated Self-Healing Module page at `/self-healing/module`.

- The page acts as a self-healing workspace for broken Playwright and Selenium locators rather than as a test runner.
- It accepts a failing locator, a short step-goal description, and the current HTML snippet around the intended element, then ranks likely repairs for both browser stacks.
- The current engine is ML-assisted and verification-gated: deterministic candidate generation feeds a trained logistic reranker, and a suggested heal is only considered safe after a deterministic follow-up check.
- The module includes app-shaped sample cases grounded in the Research Workspace, Playwright Module, and auth flows so repair strategies can be explored without leaving the app.
- The page route was renamed for clarity, but the underlying compatibility-oriented API surface still uses `/api/locator-repair/*` and the current training command remains `npm run locator-repair:train`.
- In practice, the Self-Healing Module gives the project a place to reason about selector drift explicitly instead of hiding repair logic inside failing browser suites.

### Security Architecture Modules Overview

The Research Workspace now includes a set of focused security-architecture modules for the access, assurance, and browser-hardening layers:

- `/mission-assurance/module` models RBAC-plus-ABAC decisions using mission role, clearance, assigned mission, device trust, network zone, and break-glass state.
- `/hardware-mfa/module` inspects hardware-token and PKI posture, supports WebAuthn-backed enrollment and assertion flows, and exposes whether strong-factor step-up is currently satisfied.
- `/session-management/module` shows strict idle and absolute timeout policy, concurrent-login prevention, and abandoned-terminal lockdown scenarios.
- `/injection-prevention/module` explains the request guard, Mongo operator-key blocking, and safe query posture enforced through Mongoose defaults.
- `/xss-defense/module` surfaces escaped rendering, strict CSP behavior, and how suspicious payloads are handled before they become script execution.
- `/access-control/module` catalogs protected API routes and demonstrates that the server re-verifies identity, ownership, and policy even when a frontend control is visible or hidden.

### Selenium Module Overview

The Research Workspace also links to a dedicated Selenium Module page at `/selenium/module`.

- The page acts as a browser-automation planning, reporting, and export surface for this app's authenticated research flows.
- It exposes scenario metadata for auth, notes, the Research Workspace, Security Module, ML Module, Selenium Module itself, and a full cross-module smoke suite.
- The module reads `artifacts/selenium-results.json` so it can show the latest suite status, runtime metadata, covered suite files, and per-scenario badges instead of a static catalog.
- The module shows browser prerequisites, route-level coverage goals, stable assertion targets, and generated JavaScript templates built around `selenium-webdriver`.
- The exported scripts are intentionally smoke-test oriented: they prioritize stable route navigation, headings, and module controls rather than brittle low-level DOM behavior.
- In practice, the Selenium Module gives the project a bridge from in-app research tooling to external browser automation and CI smoke coverage, and the latest verified artifact covers 11 registered Selenium scenarios.

### Optional Autonomous Response

The app can use trained alert-triage output to react to newly ingested incidents from the scheduled automation pipeline and the Redis-backed realtime worker.

Typical flow:

- log or intrusion ingestion creates a `SecurityAlert`
- the ML triage layer assigns `mlScore`, `mlLabel`, `mlReasons`, and `scoreSource`
- the autonomous response policy decides `none`, `notify`, or `block`
- the alert stores a response audit trail so the dashboards can show what was attempted

Optional environment:

```env
AUTONOMOUS_RESPONSE_ENABLED=true
AUTONOMOUS_RESPONSE_ALLOWED_SOURCES=server-log-batch,intrusion-runner,realtime-ingest
AUTONOMOUS_NOTIFY_SCORE_THRESHOLD=0.72
AUTONOMOUS_BLOCK_SCORE_THRESHOLD=0.90
AUTONOMOUS_REQUIRE_TRAINED_MODEL_FOR_BLOCK=true
AUTONOMOUS_NOTIFY_ON_IMPORTANT_FEEDBACK=true

SLACK_WEBHOOK_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_TO=

BLOCK_WEBHOOK_URL=
BLOCK_WEBHOOK_SECRET=
```

Notes:

- Autonomous response is intentionally scoped to ingested incidents, not manual demo actions such as the Security Module sample injector.
- A `notify` decision uses the existing Slack-email summary notifier.
- A `block` decision also requires a concrete target such as `details.ip`, `details.src`, or `details.target`.
- If notification or block providers are not configured, the response is still recorded on the alert as a skipped action for auditability.
- The ML Module's autonomy panels read stored alert response metadata, so after using `Autonomy Demo Inject` the `Observed Autonomous Outcomes` and `Action Outcomes` panels should move immediately on refresh.

## API Documentation

**Base URL:** `/api/notes`  
**Authentication:** Required for all endpoints (session cookie)

### Authentication

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/auth/signup` | POST | `email`, `password` | Redirect to `/auth/login` |
| `/auth/login` | POST | `email`, `password` | Redirect to `/` |
| `/auth/logout` | GET | - | Logout confirmation page or redirect to `/auth/login` |
| `/auth/logout` | POST | - | Redirect to `/auth/login` |

**Validation:**
- Email: Valid format, max 254 chars, unique
- Password: Min 8 chars, contains uppercase, lowercase, number
- Login payload: only `email` and `password` fields are accepted
- Local login failures return a generic invalid-credentials response to avoid account/provider enumeration
- Google OAuth routes require both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Login, signup, logout, note mutations, log analysis, scan import, and sample-correlation actions require a valid CSRF token

### Notes API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/notes` | GET | Get all user's notes |
| `GET /api/notes/:id` | GET | Get single note |
| `POST /api/notes` | POST | Create note |
| `PUT /api/notes/:id` | PUT | Update note (partial updates allowed) |
| `DELETE /api/notes/:id` | DELETE | Delete note |

#### Example Requests

**Create Note:**
```json
POST /api/notes
{
  "title": "Meeting Notes",
  "content": "Discussed Q1 goals",
  "image": "https://example.com/image.jpg"
}
```

**Update Note:**
```json
PUT /api/notes/:id
{
  "title": "Updated Title"
}
```

#### Success Response Format
```json
{
  "success": true,
  "message": "Note created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Meeting Notes",
    "content": "Discussed Q1 goals",
    "image": "https://example.com/image.jpg",
    "user": "507f191e810c19729de860ea",
    "createdAt": "2026-02-17T10:30:00.000Z",
    "updatedAt": "2026-02-17T14:22:00.000Z"
  }
}
```

#### Error Response Format
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Title is required", "Image must be a valid URL"]
}
```

#### Validation Rules

| Field | Required | Min | Max | Format |
|-------|----------|-----|-----|--------|
| `title` | Yes (create) | 3 | 200 | Non-empty string |
| `content` | No | - | 10,000 | String |
| `image` | No | - | 500 | Valid HTTP/HTTPS URL |

#### Notes Payload Hardening

- `POST /api/notes` and `PUT /api/notes/:id` only accept `title`, `content`, and `image`
- Unexpected fields are rejected with `400 Validation failed`
- Note IDs from route params are trimmed and validated before database queries
- Authenticated form posts and JSON mutations must include the session-issued CSRF token

#### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success (GET, PUT, DELETE) |
| `201` | Created (POST) |
| `400` | Validation error, invalid data |
| `401` | Authentication required |
| `404` | Note not found or access denied |
| `409` | Duplicate entry (email exists) |
| `500` | Server error |

### Page Routes

| Route | Description | Auth |
|-------|-------------|------|
| `GET /` | Home (notes list) | Yes |
| `GET /notes` | Notes list | Yes |
| `GET /notes/new` | Create note form | Yes |
| `GET /notes/:id` | View note | Yes |
| `GET /notes/:id/edit` | Edit note form | Yes |
| `GET /research` | Unified Research Workspace | Yes |
| `GET /ml` | Redirects to the dedicated ML Module page | Yes |
| `GET /ml/module` | Dedicated ML Module page | Yes |
| `GET /mission-assurance` | Redirects to the dedicated Mission Assurance Module page | Yes |
| `GET /mission-assurance/module` | Dedicated Mission Assurance Module page | Yes |
| `GET /hardware-mfa` | Redirects to the dedicated Hardware-First MFA Module page | Yes |
| `GET /hardware-mfa/module` | Dedicated Hardware-First MFA Module page | Yes |
| `GET /session-management` | Redirects to the dedicated Session Management Module page | Yes |
| `GET /session-management/module` | Dedicated Session Management Module page | Yes |
| `GET /injection-prevention` | Redirects to the dedicated Injection Prevention Module page | Yes |
| `GET /injection-prevention/module` | Dedicated Injection Prevention Module page | Yes |
| `GET /xss-defense` | Redirects to the dedicated XSS Defense Module page | Yes |
| `GET /xss-defense/module` | Dedicated XSS Defense Module page | Yes |
| `GET /access-control` | Redirects to the dedicated Access Control Module page | Yes |
| `GET /access-control/module` | Dedicated Access Control Module page | Yes |
| `GET /playwright` | Redirects to the dedicated Playwright Module page | Yes |
| `GET /playwright/module` | Dedicated Playwright Module page | Yes |
| `GET /self-healing` | Redirects to the dedicated Self-Healing Module page | Yes |
| `GET /self-healing/module` | Dedicated Self-Healing Module page | Yes |
| `GET /selenium` | Redirects to the dedicated Selenium Module page | Yes |
| `GET /selenium/module` | Dedicated Selenium Module page | Yes |
| `GET /auth/login` | Login page | - |
| `GET /auth/signup` | Signup page | - |
| `GET /auth/logout` | Logout confirmation page | Yes |
| `GET /security/logs` | Redirects to the Logs section in `/security/module` | Yes |
| `GET /security/scans` | Redirects to the Scans section in `/security/module` | Yes |
| `GET /security/correlations` | Redirects to the Correlations section in `/security/module` | Yes |
| `GET /security/automation` | Redirects to the Automation section in `/security/module` | Yes |
| `GET /security/module` | Dedicated Security Module page | Yes |
| `POST /seed` | Seed database (dev only) | Yes |

### Security API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/security/alerts` | GET | Get recent log-derived security alerts |
| `GET /api/security/correlations` | GET | Correlate imported scans with observed alerts |
| `POST /api/security/automation/sample` | POST | Inject demo alert and scan data for the currently authenticated user and refresh the workspace with visible findings |
| `POST /api/security/correlations/sample` | POST | Inject sample correlation data for demos |
| `POST /api/security/log-analysis` | POST | Analyze log lines and generate alerts |
| `GET /api/security/scans` | GET | Get imported vulnerability scans |
| `POST /api/security/scan-import` | POST | Import parsed scan results |
| `POST /api/security/realtime-ingest` | POST | Queue realtime ingestion payloads when realtime is enabled |
| `GET /api/security/stream` | GET | Subscribe to live security events with Server-Sent Events when realtime is enabled |

### ML API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/ml/overview` | GET | Get the current ML Module overview, including model metadata, alert score distributions, and recent scored alerts |
| `POST /api/ml/train` | POST | Train a bootstrap or hybrid alert-triage model and rescore stored alerts |
| `POST /api/ml/autonomy-demo` | POST | Inject a dry-run autonomy demo so the ML Module can show stored notify-block outcomes |

### Mission Assurance API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/mission-assurance/overview` | GET | Get the Mission Assurance Module overview, current mission profile, and policy matrix summary |
| `POST /api/mission-assurance/evaluate` | POST | Evaluate a mission access decision across role, clearance, mission, device, network, and break-glass context |

### Hardware-First MFA API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/hardware-mfa/overview` | GET | Get current hardware-token, PKI, and strong-factor session-assurance posture |
| `POST /api/hardware-mfa/register/options` | POST | Issue WebAuthn registration options for a hardware-token enrollment |
| `POST /api/hardware-mfa/register/verify` | POST | Verify and store a completed WebAuthn hardware-token enrollment |
| `POST /api/hardware-mfa/pki/register-current` | POST | Register the currently trusted PKI certificate context for the signed-in user |
| `POST /api/hardware-mfa/challenge` | POST | Start a hardware-token or PKI step-up challenge |
| `POST /api/hardware-mfa/verify` | POST | Verify a challenge response and mark the session as hardware-first assured |
| `POST /api/hardware-mfa/revoke` | POST | Revoke the current session's strong-factor assurance |

### Session Management API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/session-management/overview` | GET | Get the current session-management policy, tracked session state, and lockdown posture |
| `POST /api/session-management/evaluate` | POST | Evaluate timeout and concurrent-login scenarios such as abandoned terminals and superseded sessions |

### Injection Prevention API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/injection-prevention/overview` | GET | Get request-guard posture, Mongo query-hardening details, and sample injection-prevention guidance |
| `POST /api/injection-prevention/evaluate` | POST | Evaluate whether a sample payload would be rejected or allowed by the server-side injection-prevention layer |

### XSS Defense API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/xss-defense/overview` | GET | Get escaped-rendering and CSP posture for the XSS Defense Module |
| `POST /api/xss-defense/evaluate` | POST | Evaluate a sample payload against the app's escaping and CSP-based XSS defenses |

### Access Control API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/access-control/overview` | GET | Get the protected-route catalog and server-side access-control coverage summary |
| `POST /api/access-control/evaluate` | POST | Evaluate whether the server would allow or deny a scenario based on identity, ownership, and mission policy |

### Playwright API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/playwright/overview` | GET | Get Playwright module coverage metadata, scenario catalog entries, workflow notes, and the latest annotated run summary |
| `GET /api/playwright/script` | GET | Generate a Playwright spec template for the selected scenario |

### Self-Healing API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/locator-repair/overview` | GET | Get Self-Healing Module metadata, supported locator families, repair guidance, model state, and sample failure cases |
| `GET /api/locator-repair/history` | GET | Get recent self-healing outcomes and feedback summaries |
| `POST /api/locator-repair/suggest` | POST | Rank Playwright and Selenium locator repairs from a failing locator, step goal, and current HTML snippet |
| `POST /api/locator-repair/feedback` | POST | Record accepted, rejected, or healed self-healing feedback for a ranked candidate |
| `POST /api/locator-repair/train` | POST | Train or refresh the persisted self-healing reranker from bootstrap data and recorded feedback |

### Selenium API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/selenium/overview` | GET | Get Selenium module coverage metadata, scenario catalog entries, workflow notes, browser prerequisites, and the latest run summary |
| `GET /api/selenium/script` | GET | Generate a Selenium WebDriver script template for the selected scenario |

## Project Structure

Abbreviated high-level view; the Research Workspace now includes additional module files for Mission Assurance, Hardware-First MFA, Session Management, Injection Prevention, XSS Defense, and Access Control alongside the browser-automation modules shown below.

```text
notes-app/
├── index.js
├── package.json
├── .env.example
├── README.md
├── .github/                # CI workflows (ci.yml, security-scan.yml)
├── automation/             # Falco/Trivy runners, smoke/integration harnesses
│   ├── falco-runner.js
│   ├── trivy-runner.js
│   ├── test-smoke.js
│   └── test-integration.js
├── src/
│   ├── config/
│   │   ├── passport.js
│   │   └── runtimeConfig.js
│   ├── controllers/
│   │   ├── mlApiController.js
│   │   ├── locatorRepairApiController.js
│   │   ├── noteApiController.js
│   │   ├── playwrightApiController.js
│   │   ├── scanApiController.js
│   │   ├── securityApiController.js
│   │   └── seleniumApiController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── csrf.js
│   │   └── rateLimit.js
│   ├── models/
│   │   ├── Notes.js
│   │   ├── ScanResult.js
│   │   ├── SecurityAlert.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── locatorRepairApiRoutes.js
│   │   ├── locatorRepairPageRoutes.js
│   │   ├── noteApiRoutes.js
│   │   ├── notePageRoutes.js
│   │   ├── playwrightApiRoutes.js
│   │   ├── playwrightPageRoutes.js
│   │   ├── scanApiRoutes.js
│   │   ├── scanPageRoutes.js
│   │   ├── securityApiRoutes.js
│   │   ├── securityPageRoutes.js
│   │   ├── seleniumApiRoutes.js
│   │   └── seleniumPageRoutes.js
│   ├── services/
│   │   ├── alertTriageTrainingService.js
│   │   ├── automationService.js
│   │   ├── autonomyDemoService.js
│   │   ├── incidentResponseService.js
│   │   ├── locatorRepairResearchService.js
│   │   ├── playwrightResearchService.js
│   │   └── seleniumResearchService.js
│   ├── utils/
│   │   ├── errorHandler.js
│   │   ├── logAnalysis.js
│   │   ├── intrusionParser.js   # Falco JSON parser
│   │   ├── noteEncryption.js
│   │   ├── pagination.js
│   │   ├── scanParser.js
│   │   └── validation.js
│   └── views/
│       ├── pages/
│       │   ├── home.ejs
│       │   ├── locator-repair-module.ejs
│       │   ├── login.ejs
│       │   ├── logout.ejs
│       │   ├── ml-module.ejs
│       │   ├── note-form.ejs
│       │   ├── note.ejs
│       │   ├── playwright-module.ejs
│       │   ├── research.ejs
│       │   ├── security-automation.ejs
│       │   ├── selenium-module.ejs
│       │   └── signup.ejs
│       └── public/
│           ├── css/
│           └── js/
└── test/
  ├── authRoutes.test.js
  ├── csrf.test.js
  ├── noteApiController.test.js
  ├── notePageRoutes.test.js
  ├── scanApiRoutes.test.js
  ├── securityApiRoutes.test.js
  └── integration/
    └── automation.test.js
```

## Development

**NPM Scripts:**
```bash
npm start          # Production
npm run start-dev  # Development
npm run local:run  # Windows launcher in a dedicated shell
npm run local:run:worker  # Launcher + realtime worker
npm run pm2:start  # Start the web app under PM2
npm run pm2:start:worker  # Start the web app and worker under PM2
npm run pm2:restart # Restart the PM2-managed processes
npm run pm2:stop   # Stop the PM2-managed processes
npm run pm2:status # Show PM2 process state
npm run pm2:logs   # Tail PM2 logs for the web app
npm test           # Run test suite
npm run test:e2e   # Run Playwright browser suite in Chromium
npm run test:e2e:all  # Run Playwright browser suite across all configured browsers
npm run test:selenium # Run Selenium browser suite and refresh the Selenium results artifact
npm run lint       # ESLint code quality check
```

**Testing Notes:**
- `npm test` now loads `test/testSetup.js` before the suite so tests run in `NODE_ENV=test` with Redis-backed realtime disabled by default.
- The suite includes request-level integration coverage in `test/integration/appFlows.e2e.test.js` for note CRUD, server-rendered note flows, the Security Module workflow, the ML Module overview path, Mission Assurance, Hardware-First MFA, Session Management, Injection Prevention, XSS Defense, Access Control, the Self-Healing Module overview/suggestion flow, and the Selenium Module overview/script flow.
- The dedicated Playwright browser suite lives under `playwright-tests/` and exercises auth, notes, research, security, Selenium, and Playwright module flows. Its latest JSON report is written to `artifacts/playwright-results.json`, which drives `/playwright/module`.
- `npm run test:selenium` runs through `scripts/run-selenium-suite.js`, and the dedicated Selenium browser suite under `selenium-tests/` exercises the live app through `selenium-webdriver`, including the dedicated `/selenium/module` page, its latest-run summary, and its generated script controls.

### Stable Local Run Paths

If the app is started from a short-lived shell or editor-integrated task runner, the Node process can be terminated when that parent shell exits. On Windows, that can surface as a browser refresh briefly showing "this site can't be reached" before the app is started again.

Use one of these stable local paths instead:

```powershell
.\run-local.ps1
.\run-local.ps1 -WithWorker
```

The launcher opens dedicated PowerShell windows that keep the processes alive independently of the shell that started them.

### PM2 for Persistent Local Processes

The repository now includes `ecosystem.config.cjs` for PM2-managed local processes:

```bash
npm install -g pm2
npm run pm2:start
npm run pm2:start:worker
npm run pm2:status
npm run pm2:logs
npm run pm2:stop
```

The PM2 config starts:
- `note-app-web` from `index.js`
- `note-app-worker` from `src/workers/realtimeProcessor.js`

Both processes read the same `.env` / `.env.local` startup configuration as the standard app scripts.

**Adding Features:**
1. Update schemas in `src/models/`
2. Add validation rules in `src/utils/validation.js`
3. Implement logic in `src/controllers/`
4. Define routes in `src/routes/`
5. Create/update EJS templates in `src/views/`
6. Write tests in `test/`

## CI & Automation Notes

- **Node version (CI):** Workflows use Node.js 20.8.0 to satisfy engine constraints for some deps (e.g., connect-mongo). If you change engines, update `.github/workflows/*.yml` accordingly.
- **Lockfile:** If `npm ci` fails with a lockfile mismatch, run `npm install` locally and commit the updated `package-lock.json`.
- **Semgrep:** Some custom rules require a `languages` field. If Semgrep aborts, add `languages: [javascript]` to each rule in `.semgrep.yml`.
- **Linting:** Keep `npm run lint` green locally before pushing. The current repository state is lint-clean.
- **Trivy (security-scan):** The security scan workflow uploads Trivy reports as artifacts but is configured as report-only (`exit-code: 0`). Download artifacts from the run to triage vulnerabilities.

### How to run the automation runners locally

1. Start the app (so services can connect to MongoDB):
```bash
npm run start-dev
```
2. In another shell, run the Falco or Trivy runners for local testing:
```bash
node automation/falco-runner.js   # Falco JSON ingestion helper
node automation/trivy-runner.js   # Trivy image/file scanner wrapper
```
3. If you want realtime delivery in the Security Module UI, start the worker with Redis configured:
```bash
npm run worker
```
4. To run the smoke/integration harnesses:
```bash
node automation/test-smoke.js
node automation/test-integration.js
npx mocha --exit test/integration/automation.test.js
```

### Automation Runners (Trivy / Falco)

The repository includes small runner helpers that execute external scanner commands and write their output to files consumed by the app.

- `automation/trivy-runner.js` — runs the configured `TRIVY_CMD` and writes JSON output to `TRIVY_OUTPUT_PATH` atomically. It now streams stdout using `spawn` to avoid process buffer limits for large JSON outputs.
- `automation/falco-runner.js` — helper for reading Falco JSON output and writing to the configured input file for the ingestion pipeline.

Key environment variables:

```
TRIVY_CMD="trivy image --format json --quiet my-image:latest"
TRIVY_OUTPUT_PATH=automation/trivy-output.json
TRIVY_INTERVAL_MS=0       # 0 runs once; >0 runs every N milliseconds

LOG_BATCH_ENABLED=false
LOG_BATCH_FILE_PATH=
LOG_BATCH_USER_ID=
LOG_BATCH_INTERVAL_MS=60000

SCAN_BATCH_ENABLED=false
SCAN_BATCH_FILE_PATH=
SCAN_BATCH_USER_ID=
SCAN_BATCH_INTERVAL_MS=300000

INTRUSION_BATCH_ENABLED=false
INTRUSION_BATCH_FILE_PATH=
INTRUSION_BATCH_USER_ID=
INTRUSION_BATCH_INTERVAL_MS=5000
```

Notes:

- The runners write output atomically to avoid partial reads by the app.
- Provide full commands (including image name or file path) in `TRIVY_CMD` — the runner simply shells out and captures stdout.
- Use `TRIVY_INTERVAL_MS` to schedule repeated scans. For long-running scans choose an interval larger than the scanner runtime to avoid overlap.
- On CI or in containerized environments, prefer setting `TRIVY_CMD` and `TRIVY_OUTPUT_PATH` explicitly and ensure the scanner binary is available in the runtime image.

Example (run Trivy once locally and view output):

```bash
TRIVY_CMD="trivy image --format json --quiet alpine:latest" TRIVY_OUTPUT_PATH=automation/trivy-output.json node automation/trivy-runner.js
cat automation/trivy-output.json | jq '.'
```


### Troubleshooting quick commands
- Update lockfile and push:
```bash
npm install
git add package-lock.json
git commit -m "chore: update package-lock.json"
git push
```
- Fix Semgrep rule schema:
```bash
# edit .semgrep.yml and add `languages: [javascript]` to custom rules
git add .semgrep.yml
git commit -m "fix(semgrep): add languages to rules"
git push
```

## Security

**Implemented:**
- Environment variables for secrets
- Password hashing (bcrypt, 10 salt rounds)
- Session-based authentication with Passport.js
- MongoDB-backed persistent session storage
- Session regeneration on login and session destruction on logout
- CSRF protection for form posts and authenticated JSON mutations
- Helmet security headers with Content Security Policy and clickjacking protection
- Explicit CSRF token injection in rendered page view-models
- DOM-safe status message rendering on the security dashboards
- Startup validation for required secret configuration
- Dedicated encryption key for notes at rest
- Optional compatibility support for note-encryption key rotation
- Generic authentication responses for login/signup enumeration resistance
- Input validation plus request-level Mongo injection blocking
- Escaped rendering backed by strict Content Security Policy
- User-specific authorization checks
- Global server-side API access-control enforcement for protected endpoints
- Mission-role and attribute-aware authorization checks for sensitive research actions
- Hardware-first MFA with WebAuthn-backed enrollment/assertion flows and PKI-aware session assurance
- Strict session timeouts, absolute session limits, and concurrent-login invalidation
- MongoDB ObjectId validation
- Authentication, destructive action, and security-analysis route rate limiting
- Clean production dependency audit after upgrading to EJS 5
- Optional background ingestion for logs and scan files, with deduplication to reduce duplicate records during scheduled automation
- Demo automation sample injection that bypasses historical dedupe when invoked with a zero dedupe window so visible alert records can be recreated on demand

**Keytar / secrets note:**

- The app attempts to load Google OAuth client secrets from the system keyring via `keytar` at startup (`src/config/localSecrets.js`). This is optional and intended for developer convenience on machines with a keyring.
- In CI or container environments where `keytar` isn't available, the startup logs a warning and the app continues; provide secrets via environment variables instead.
- For local development, prefer `.env.local` for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_BASE_URL`; `.env.local` overrides `.env` and is excluded from git.
- If you do not want to rely on the local keyring, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` directly in the environment instead.

**Production Checklist:**
- [ ] Strong `SESSION_SECRET` (32+ random chars)
- [ ] Dedicated `NOTE_ENCRYPTION_KEY` (32 bytes, separate from `SESSION_SECRET`)
- [ ] HTTPS enabled with `cookie.secure: true`
- [x] Rate limiting (`express-rate-limit`) on authentication and destructive development actions
- [x] Security headers (`helmet`) with CSP and frame protections
- [x] Production dependency audit currently clean (`npm audit --omit=dev`)
- [ ] Regular dependency updates
- [ ] MongoDB connection with TLS

## Deployment

**Required Environment Variables:**
```env
NODE_ENV=production
MONGODB_URI=<your-mongodb-connection-string>
SESSION_SECRET=strong-random-secret-min-32-chars
NOTE_ENCRYPTION_KEY=64-char-hex-key
PORT=3000
```

**Optional Google OAuth Variables:**
```env
APP_BASE_URL=https://your-domain.example
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

**Optional Migration Variables:**
```env
LEGACY_NOTE_ENCRYPTION_KEY=<previous-32-byte-key>
ALLOW_LEGACY_SESSION_SECRET_FALLBACK=false
```

**Optional Automation Variables:**
```env
LOG_BATCH_ENABLED=false
LOG_BATCH_FILE_PATH=

LOG_BATCH_USER_ID=
LOG_BATCH_SOURCE=server-log-batch
LOG_BATCH_INTERVAL_MS=60000
LOG_BATCH_MAX_READ_BYTES=65536
LOG_BATCH_DEDUPE_WINDOW_MS=300000

SCAN_BATCH_ENABLED=false
SCAN_BATCH_FILE_PATH=
SCAN_BATCH_USER_ID=
SCAN_BATCH_SOURCE=scheduled-scan-import
SCAN_BATCH_INTERVAL_MS=300000
SCAN_BATCH_DEDUPE_WINDOW_MS=3600000

INTRUSION_BATCH_ENABLED=false
INTRUSION_BATCH_FILE_PATH=
INTRUSION_BATCH_USER_ID=
INTRUSION_BATCH_SOURCE=intrusion-runner
INTRUSION_BATCH_INTERVAL_MS=5000
INTRUSION_BATCH_DEDUPE_WINDOW_MS=300000

REDIS_URL=
ENABLE_REALTIME=0
```

The automation mode is meant to stay simple: an external log writer and an external scanner refresh the files, and the app ingests them on a schedule.



**Deploy Commands:**

```bash
# Heroku
heroku create app-name
heroku config:set MONGODB_URI=... SESSION_SECRET=... NOTE_ENCRYPTION_KEY=...
git push heroku main

# VPS with PM2
npm install pm2 -g
pm2 start index.js --name note-app
pm2 save && pm2 startup
```

**Render/Railway/Fly.io:** Deploy from GitHub, set env vars in dashboard, use `npm start`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing MONGODB_URI error | Create `.env` file with valid connection string |
| Authentication fails | Clear cookies, verify `SESSION_SECRET` is set and not a placeholder |
| Missing NOTE_ENCRYPTION_KEY error | Generate a 32-byte key and set `NOTE_ENCRYPTION_KEY` |
| Google sign-in unavailable | Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` together, preferably in `.env.local`, or leave both unset |
| Google shows "Access blocked: This app's request is invalid" | Make sure `APP_BASE_URL` matches the redirect URI registered in Google Cloud exactly. For local development, use `http://localhost:3000/auth/oauth2/redirect/google` |
| Older encrypted notes no longer decrypt after key rotation | Set `LEGACY_NOTE_ENCRYPTION_KEY`, re-save affected notes, then remove the compatibility setting |
| `csrfToken is not defined` in an EJS page | Ensure the route renders the page with `csrfToken: res.locals.csrfToken` and the request passed through the CSRF middleware |
| `MongoStore.create is not a function` on startup | Use `const { MongoStore } = require('connect-mongo')` with the installed CommonJS package version |
| Realtime endpoints return 404 or 503 | Set `REDIS_URL`, enable realtime with `ENABLE_REALTIME=1` (or the dev toggle endpoint), and start `npm run worker` |
| Browser refresh sometimes shows "This site can't be reached" locally | Launch from `.\run-local.ps1` or PM2 instead of a transient shell session so the Node process stays attached to a persistent parent |
| Tests fail | Run `npm install`, ensure Node.js v18+ |
| Port already in use | Set `PORT` env variable or kill process on port 3000 |
| Database connection fails | Check MongoDB Atlas IP whitelist or local MongoDB status |

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/name`)
3. Make changes & add tests
4. Run `npm test` and `npm run lint`
5. Commit with clear message
6. Push and open a pull request

**Code Standards:** Follow existing patterns, add tests for new features, update documentation

## License

ISC



