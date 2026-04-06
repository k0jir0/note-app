# Helios

Helios is an authenticated notes application with an integrated Research Workspace. The core product is straightforward: signed-in users create and manage encrypted notes, and the same app includes companion modules for security operations, browser automation, and operational assurance.

That boundary matters. Helios is not a general-purpose SOC platform, and it is not a standalone compliance product. The research modules exist to make the notes application inspectable: they show how the app handles alert triage, audit telemetry, break-glass controls, supply-chain posture, access policy, session security, MFA, and browser-test generation inside one authenticated product.

## What Lives Here

- Encrypted note CRUD with per-user access control and authenticated same-origin note images.
- Local username/password authentication plus optional Google sign-in.
- A Research Workspace at `/research` with modules for security operations, alert triage, supply-chain visibility, audit telemetry, break-glass posture, browser automation, locator repair, injection prevention, XSS defense, access control, mission assurance, hardware-backed MFA, and session management.
- Hardened runtime defaults such as CSRF protection, Helmet headers, strict CSP, injection prevention, session controls, immutable audit hooks, and transport enforcement.
- Repository automation for SBOM checks, dependency auditing, image scanning, and recurring ITSG-33 evidence collection.

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose, Passport, express-session, connect-mongo, Helmet
- Frontend: EJS, Bootstrap, vanilla JavaScript
- Testing: Mocha, Chai, Sinon, Playwright, Selenium WebDriver, ESLint
- Delivery: Docker, distroless runtime images, Nginx sandboxing, Kubernetes manifests, GitHub Actions

## Quick Start

### Prerequisites

- Node.js 22 LTS
- npm
- MongoDB Atlas or local MongoDB

### Install

```bash
git clone https://github.com/k0jir0/helios.git
cd helios
npm install
```

### Configure Environment

```bash
cp .env.example .env
cp .env.local.example .env.local
```

Minimum local `.env` values:

```env
MONGODB_URI=mongodb://localhost:27017/helios
SESSION_SECRET=replace-with-a-long-random-secret
NOTE_ENCRYPTION_KEY=replace-with-64-char-hex-key
NODE_ENV=development
PORT=3000
ENABLE_PRIVILEGED_DEV_TOOLS=false
```

Optional local-only OAuth settings belong in `.env.local`:

```env
APP_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Generate strong local secrets:

```bash
node -e "const crypto=require('crypto'); console.log('SESSION_SECRET=' + crypto.randomBytes(48).toString('hex')); console.log('NOTE_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));"
```

### Run

```bash
npm run start-dev
```

Local app URL:

```text
http://localhost:3000
```

## Main Routes

- `/auth/signup` and `/auth/login`: account creation and sign-in
- `/notes`: encrypted notes home
- `/research`: Research Workspace landing page
- `/security/module`: security operations
- `/ml/module`: alert triage model tooling
- `/playwright/module` and `/selenium/module`: browser automation workspaces
- `/audit-telemetry/module`: auditability and immutable logging posture
- `/supply-chain/module`: SBOM, dependency, and hardened-image posture

## Useful Commands

```bash
npm test
npm run lint
npm run audit:deps
npm run audit:prod
npm run sbom:check
npm run sbom:generate
npm run itsg33:repo-checks
npm run itsg33:audit-health
npm run itsg33:backup-restore:drill
npm run itsg33:break-glass:drill
npm run itsg33:infrastructure:check
npm run itsg33:secret-rotation:check
npm run itsg33:governance:diff
```

Browser automation support:

```bash
npx playwright install
npm run test:e2e
npm run test:e2e:all
npm run test:selenium
```

## Security Posture

- `/metrics` is protected. Access requires either an authenticated admin session or `METRICS_AUTH_TOKEN` through `Authorization: Bearer <token>` or `X-Metrics-Token`.
- `/healthz` returns anonymous readiness only. Full break-glass and immutable-logging diagnostics require an authenticated admin session or the diagnostics token path used by operations tooling.
- Dependency audits are enforced through `npm audit`-based scripts.
- The committed CycloneDX SBOM is checked against `package-lock.json`.
- The Security Scan CI workflow builds the hardened application image and fails on high or critical Trivy image findings.

## Deployment Notes

Docker build:

```bash
docker build -t helios:hardened .
docker run --rm -p 3000:3000 --env-file .env helios:hardened
```

Local sandbox:

```bash
docker compose -f docker-compose.sandbox.yml up --build -d
docker compose -f docker-compose.sandbox.yml logs -f proxy app mongo
docker compose -f docker-compose.sandbox.yml down
```

Kubernetes helpers:

```bash
npm run k8s:apply
npm run k8s:rotate
npm run k8s:teardown
```

The Docker sandbox and Kubernetes manifests model the same separation of concerns:

- a public proxy tier
- an internal app tier
- an internal data tier

## ITSG-33 Repository Automation

This repository includes release, monthly, quarterly, and annual evidence workflows plus supporting scripts for audit health, privileged-access reporting, backup and restore drills, break-glass drills, infrastructure conformance, secret-rotation age checks, and governance diffs.

That repo automation is useful evidence, but it is not the whole control program. The codebase can show implementation posture and recurring checks; it cannot replace environment-specific approvals, operational sign-off, personnel controls, or physical controls. For the current review state and evidence expectations, see:

- `docs/itsg33-review.md`
- `docs/itsg33-control-matrix.md`
- `docs/itsg33-evidence-checklist.md`
- `docs/itsg33-operations-runbook.md`
- `docs/itsg33-automation-analysis.md`

## Project Shape

- `src/app`: Express app assembly and route registration
- `src/routes`: page and API route modules
- `src/features/research`: research-module catalog and workspace metadata
- `src/services`: business logic, research services, automation helpers, and assurance services
- `docs`: ITSG-33 review notes, evidence guidance, and operations runbooks
- `.github/workflows`: CI, evidence collection, and recurring governance workflows
