ITSG-33 Control Matrix
======================

Purpose
-------

This matrix translates the repository's current security posture and the remaining operational obligations into a single working reference. It is meant to support release review, internal control assessment, and recurring evidence collection.

How to use this matrix
----------------------

- Treat repository-enforced controls as implementation evidence, not as a substitute for operations evidence.
- Treat operational actions as required work before claiming a family is fully satisfied.
- Update the evidence references whenever workflows, deployment targets, or ownership change.

AC - Access Control
-------------------

Implemented controls

- Server-side API authorization and protected-path handling in `src/middleware/apiAccessControl.js`.
- Mission and module access gating through the mission access middleware and catalog.
- Privileged runtime and break-glass restrictions in `src/middleware/privilegedRuntime.js`.

Operational actions

- Review all `admin` and `break_glass` assignments at least quarterly.
- Require a tracked approval for every privileged role grant or removal.
- Verify dormant privileged accounts are disabled or removed.

Evidence to retain

- Export or screenshot of current privileged users and roles.
- Approval ticket, PR, or change record for each privileged role change.
- Sample authorization-denial audit record for privileged runtime access.

Residual status

- Code-enforced access control is in place.
- User and role governance remains an operational responsibility.

AU - Audit and Accountability
-----------------------------

Implemented controls

- Request-scoped immutable audit capture in `src/middleware/immutableRequestAudit.js`.
- Hash-chained persisted audit records in `src/services/persistentAuditService.js`.
- Privileged-runtime denial auditing in `src/middleware/privilegedRuntime.js`.
- Audit delivery health surfaced by `/healthz` through `src/app/createApp.js`.

Operational actions

- Review audit health and high-risk authorization denials on a defined cadence.
- Escalate any `immutableLogging.degraded` or sink-outage condition.
- Define the retention period and review process for remote immutable logs.

Evidence to retain

- `/healthz` response showing immutable logging status in the target environment.
- Sample persisted audit event and corresponding sink delivery record.
- Review notes for denied privileged actions and emergency-mode changes.

Residual status

- Audit generation is implemented.
- Review discipline, retention, and alerting remain operational controls.

CM - Configuration Management
-----------------------------

Implemented controls

- Runtime validation in `src/config/runtimeConfig.js`.
- Required CI checks and PR workflow on `main`.
- Enforced SBOM consistency via `npm run sbom:check` and `scripts/check-sbom.js`.

Operational actions

- Maintain an approved baseline for environment variables, deployment manifests, and branch-protection settings.
- Require PR-based review for all production-impacting configuration changes.
- Track approved deviations from the baseline.

Evidence to retain

- Link to the PR that changed configuration.
- Output of `npm run sbom:check` for the release candidate.
- Snapshot of current branch-protection settings and required checks.

Residual status

- Repo-level configuration controls are strong.
- Formal baseline ownership and deviation management remain process requirements.

IA - Identification and Authentication
-------------------------------------

Implemented controls

- Local auth plus optional Google OIDC in the auth stack.
- Hardware-first MFA services and privileged step-up validation.
- Strict session timeouts and concurrent login controls.

Operational actions

- Review MFA enrollment and exception handling.
- Rotate OAuth credentials and other authentication secrets on schedule.
- Define a response path for lost or compromised authenticators.

Evidence to retain

- Current MFA policy and exception approvals.
- Secret-rotation record for auth-related credentials.
- Sample privileged action showing recent hardware-first step-up evidence.

Residual status

- Application enforcement exists.
- Enrollment governance and credential lifecycle remain operational.

SC - System and Communications Protection
-----------------------------------------

Implemented controls

- Helmet and CSP protections in app composition.
- HTTPS and TLS posture validation in runtime config.
- Metrics endpoint authorization and protected server-side routing.

Operational actions

- Confirm TLS settings and certificates in each deployed environment.
- Verify reverse proxy and load balancer headers are still trusted as designed.
- Review exposed ports and public endpoints after infrastructure changes.

Evidence to retain

- Environment configuration showing TLS and proxy settings.
- Successful protected endpoint checks in staging or production.
- Network or ingress review showing only intended public entry points.

Residual status

- App-level communications protections exist.
- Infrastructure validation and certificate management remain external.

SI - System and Information Integrity
-------------------------------------

Implemented controls

- Blocking Trivy image scan in `.github/workflows/security-scan.yml`.
- Dependency audit enforcement in `.github/workflows/dependency-audit.yml`.
- Semgrep and DAST in `.github/workflows/security.yml`.
- Injection-prevention and XSS/CSP protections in middleware and config.

Operational actions

- Maintain a vulnerability remediation SLA for image, dependency, and code-scan findings.
- Track approved exceptions and expiry dates for unresolved findings.
- Verify that CI failures block release promotion.

Evidence to retain

- Green workflow runs for CI, Security CI, Security Scan CI, and Dependency Audit.
- Trivy and audit artifacts for the release candidate.
- Ticket trail for any accepted security exception.

Residual status

- Automated integrity controls are in place.
- Exception handling and remediation timelines remain operational.

CP - Contingency Planning
-------------------------

Implemented controls

- Break-glass application modes and emergency routing.
- Health endpoint and deploy-time verification paths.

Operational actions

- Define backup scope, recovery time objective, and recovery point objective.
- Perform restore exercises on a scheduled basis.
- Document emergency contacts and fallback procedures for the hosting environment.

Evidence to retain

- Backup configuration record for the deployed database and secrets platform.
- Restore exercise notes including timestamps, success criteria, and issues found.
- Completed break-glass drill record.

Residual status

- Emergency app behavior exists.
- Backup, restore, and continuity exercises are not solved by the repo alone.

MP - Media Protection
---------------------

Implemented controls

- Encryption-aware application posture and secret-driven runtime configuration.

Operational actions

- Ensure backups, exports, and copied diagnostics are encrypted at rest and access-controlled.
- Define handling requirements for exported logs, SBOMs, scan reports, and database dumps.
- Securely destroy temporary media produced during incident response or testing.

Evidence to retain

- Backup encryption configuration.
- Storage access policy for exported operational artifacts.
- Disposal or cleanup record for temporary incident-response media.

Residual status

- Mostly operational and platform dependent.

PE - Physical and Environmental Protection
------------------------------------------

Implemented controls

- None directly in application code.

Operational actions

- Confirm the hosting provider or on-prem environment enforces facility access, power, and environmental protections appropriate to the system category.
- Keep the provider attestation or internal facility control record current.

Evidence to retain

- Hosting-provider security attestation or internal facility control evidence.
- Annual review record tying the application environment to the approved hosting control set.

Residual status

- Fully external to the repository.

PS - Personnel Security
-----------------------

Implemented controls

- None directly in application code.

Operational actions

- Ensure onboarding, offboarding, background screening, training, and acknowledgment processes exist for personnel with privileged access.
- Review whether any user retains admin or break-glass access after role changes.

Evidence to retain

- Security training completion record.
- Offboarding checklist for departing privileged users.
- Quarterly privileged-access attestation.

Residual status

- Fully operational and organizational.

PM / PL / RA / CA - Governance, Planning, Risk, and Assessment
--------------------------------------------------------------

Implemented controls

- Technical hardening review captured in `docs/itsg33-review.md`.
- Branch-protection and CI enforcement documented in `docs/branch-protection.md`.

Operational actions

- Maintain a system security plan and control-owner list.
- Re-run the control review after major architecture, auth, data-flow, or hosting changes.
- Perform periodic risk assessment and document accepted residual risk.
- Record authorization decisions and review cadence.

Evidence to retain

- Current system security plan or equivalent control package.
- Signed or approved risk review record.
- Control review date and assessor notes.

Residual status

- Governance and formal assessment remain external to the codebase, but this repository now contains the technical evidence references needed to support them.