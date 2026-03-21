# Note App

A full-stack note-taking application with user authentication, built with Node.js, Express, MongoDB, and EJS. Includes an integrated Security Module for log analysis, scan import, correlation dashboards, and optional automated ingestion to help research, triage, and demo security alerts.

## Features

- User authentication (signup/login) with Passport.js & bcrypt
- Optional Google OAuth sign-in with account linking by email
- CRUD operations for notes (create, read, update, delete)
- Encryption for note fields at rest (AES-256-GCM integration)
- User-specific data isolation and authorization checks
- Input validation & XSS protection
- Session-backed CSRF protection for forms and authenticated JSON mutations
- MongoDB-backed session persistence via connect-mongo
- Helmet security headers with Content Security Policy
- Route-specific rate limiting for auth, destructive actions, and security analysis
- Security alert log analysis dashboard (server-side log analysis)
- Scan import and findings dashboard (multi-format parsers: Nmap, Nikto, JSON)
- Correlation dashboard linking scan findings with observed security alerts
- Consolidated Research Workspace that unifies log analysis, scan import, correlations, and automation status
- Optional scheduled ingestion for logs, scans, and intrusion events (Falco JSON ingestion helper + Trivy runner support)
- Optional Redis-backed realtime ingest endpoint and live alert stream
- Built-in automation runners: Falco ingestion, Trivy scanner wrappers, and batch dedupe persistence
- Metrics endpoint exposed (`/metrics`) with `prom-client` counters/gauges for automation and scan ingestion
- Notification service (Slack integration + optional SMTP via lazy `nodemailer`) for alerting
- CI-friendly test harnesses and smoke/integration scripts (Mocha integration tests included)
- Trivy report artifacts in CI (report-only mode) to enable triage without blocking merges
- RESTful API with JSON responses
- Responsive UI with Bootstrap 5
- Test coverage with Mocha, Chai, and Sinon

## Tech Stack

**Backend:** Node.js, Express 5.2, MongoDB 8.10 (Mongoose), Passport.js, bcrypt, express-session, connect-mongo, helmet  
**Frontend:** EJS 5.0, Bootstrap 5.3, Vanilla JS  
**Testing:** Mocha, Chai, Sinon, ESLint

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
npm run start-dev  # Development (auto-reload)
npm start          # Production
npm test           # Run tests
npm run lint       # ESLint
```

Server: `http://localhost:3000`

Notes:
- `.env.local` is gitignored and overrides `.env` at startup, which makes it the safest place for machine-specific OAuth credentials.
- Local Google OAuth is intentionally normalized to `http://localhost:3000`; if you browse from `127.0.0.1`, the app redirects you to the canonical localhost URL before starting Google sign-in.

Current local verification:
- `npm test` passes with 216 tests
- `npm run lint` passes with 0 errors

4. **Create Account & Use**
- Navigate to `/auth/signup` to create an account
- Login and start creating notes
- Use `/research` to access the unified Research Workspace
- Use the Security Module link inside `/research` to run `Inject Automation Sample` and populate Alerts, Scans, and Correlations with demo data for the signed-in account
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
- In development, `POST /api/runtime/realtime` can toggle realtime on or off at runtime, but Redis still needs to be configured first.
- The Security Module page will show realtime as disabled until both Redis is available and realtime is enabled.

### Security Module Demo Sample

The Research Workspace links to a dedicated Security Module page with an `Inject Automation Sample` action.

- It writes demo alert and scan records for the currently authenticated user.
- The sample currently creates visible alert types for failed-login burst, suspicious path probing, scanner-tool detection, injection attempt, and directory enumeration.
- After completion, the workspace refreshes the Alerts, Scans, and Correlations panels so the saved records appear immediately.
- If backend sample behavior changes, restart the app and reload the Research page so both server and browser assets are current.

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

## Project Structure

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
│   │   ├── noteApiController.js
│   │   ├── scanApiController.js
│   │   └── securityApiController.js
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
│   │   ├── noteApiRoutes.js
│   │   ├── notePageRoutes.js
│   │   ├── scanApiRoutes.js
│   │   ├── scanPageRoutes.js
│   │   ├── securityApiRoutes.js
│   │   └── securityPageRoutes.js
│   ├── services/
│   │   └── automationService.js
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
│       │   ├── login.ejs
│       │   ├── logout.ejs
│       │   ├── note-form.ejs
│       │   ├── note.ejs
│       │   ├── research.ejs
│       │   ├── security-automation.ejs
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
npm run start-dev  # Development (nodemon auto-reload)
npm test           # Run test suite
npm run lint       # ESLint code quality check
```

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
- Input validation & XSS sanitization
- User-specific authorization checks
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



