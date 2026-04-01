ITSG-33 Review Snapshot
=======================

Scope
-----

This review focused on the implementable application and delivery controls that map cleanly to ITSG-33 control families for a server-side web system. The changes on this branch address concrete gaps in:

- Access Control (`AC`)
- Audit and Accountability (`AU`)
- Configuration Management (`CM`)
- System and Information Integrity (`SI`)
- Supply Chain / System Acquisition posture (`SA` / `CA`-adjacent workflow controls)

Implemented Remediations
------------------------

1. Privileged-runtime denials now emit explicit audit events.
   - File: `src/middleware/privilegedRuntime.js`
   - Rationale: privileged access denials are now recorded as structured authorization events instead of only appearing as generic HTTP request completions.

2. Immutable audit delivery health is now tracked and exposed to runtime monitoring.
   - Files: `src/services/persistentAuditService.js`, `src/app/createApp.js`
   - Rationale: operations can distinguish between healthy and degraded audit delivery without requiring strict-fail mode to terminate the process first.

3. Security image scanning now acts as an enforcing control.
   - File: `.github/workflows/security-scan.yml`
   - Rationale: the Trivy scan is pinned to a maintained release tag and fails the workflow on `HIGH` or `CRITICAL` image findings.

4. Security workflows now use the supported Node 22 runtime baseline.
   - Files: `.github/workflows/security.yml`, `.github/workflows/security-scan.yml`, `.github/workflows/dependency-audit.yml`
   - Rationale: keeps the security control path aligned with the repository's current supported Node baseline and avoids stale CI drift.

5. The committed CycloneDX SBOM is now enforced in CI.
   - Files: `scripts/generate-sbom.js`, `scripts/check-sbom.js`, `package.json`, `.github/workflows/dependency-audit.yml`
   - Rationale: the dependency-audit workflow now fails when `sbom/note-app.cdx.json` no longer matches the lockfile-derived dependency graph.

6. The local Kubernetes baseline now uses immutable support-image pins and bounded support-container resources.
   - Files: `ops/kubernetes/immutable-stack.yaml`, `ops/kubernetes/README.md`
   - Rationale: the MongoDB and Nginx support containers are now pinned to immutable image digests and run with explicit resource requests and limits, reducing supply-chain drift and noisy-neighbor risk in the local immutable stack.

7. Residual operational evidence collection now has repository-backed workflow artifacts.
   - Files: `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/*`, `docs/itsg33-evidence-checklist.md`, `docs/itsg33-operations-runbook.md`
   - Rationale: release evidence, monthly reviews, contingency drills, privileged-access reviews, and annual governance refreshes now have standardized templates and documented procedures rather than informal ad hoc tracking.

8. Repository automation now enforces ITSG-33 drift checks and recurring evidence reminders.
   - Files: `.github/workflows/ci.yml`, `.github/workflows/itsg33-release-evidence.yml`, `.github/workflows/itsg33-monthly-review.yml`, `.github/workflows/itsg33-quarterly-review.yml`, `.github/workflows/itsg33-annual-review.yml`, `.github/workflows/itsg33-k8s-support-image-refresh.yml`, `scripts/check-k8s-image-pins.js`, `scripts/check-itsg33-docs.js`, `scripts/refresh-k8s-support-image-digests.js`, `.github/dependabot.yml`
   - Rationale: the repository now checks for mutable support-image drift, validates the required ITSG-33 artifact set, publishes release-evidence rollups to pull requests, creates recurring review issues automatically, refreshes support-image digest pins through reviewable pull requests, and keeps core dependency-update automation active.

Residual Non-Code Controls
--------------------------

The following ITSG-33 control areas remain primarily operational or governance concerns and are not fully satisfiable by repository changes alone:

- Personnel Security (`PS`)
- Physical and Environmental Protection (`PE`)
- Media Protection (`MP`)
- Formal contingency exercises and backup retention operations (`CP`)
- Departmental risk governance, authorization, and formal assessment cadence (`PM`, `PL`, `RA`, `CA`)

Those areas should be handled through operating procedures, deployment standards, and periodic assessment evidence outside the application source tree.

The repository now scaffolds those activities, but the controls are only fully evidenced when the corresponding pull request records, issue forms, environment captures, and governance artifacts are actually completed.

Operational Follow-On Artifacts
-------------------------------

The residual control areas are now decomposed into the following working documents:

- `docs/itsg33-control-matrix.md` for control-family ownership, evidence, and residual status
- `docs/itsg33-evidence-checklist.md` for release, monthly, quarterly, and annual evidence collection
- `docs/itsg33-operations-runbook.md` for repeatable operating procedures tied to this repository
- `docs/itsg33-automation-analysis.md` for the current automation boundary and an implementation path for further evidence automation