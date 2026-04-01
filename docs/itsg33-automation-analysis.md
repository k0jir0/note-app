ITSG-33 Automation Analysis
===========================

Purpose
-------

This document explains how to reduce manual effort for the remaining ITSG-33 evidence and governance work without overstating what can be fully automated. The goal is to automate evidence collection, reminders, and report generation where possible, while keeping human approvals and external records in the correct system of record.

Automation boundaries
---------------------

- Automate collection, aggregation, scheduling, and issue creation where the data already exists in the repository, CI, application APIs, or deployment environment.
- Do not automate risk acceptance, privileged-access approval, or governance sign-off. Those decisions must remain human-owned.
- Do not store sensitive HR, facility, or provider attestation records directly in git unless policy explicitly allows it.
- Do not auto-trigger destructive or emergency actions in production. Break-glass and restore drills should stay gated behind human approval, and production break-glass should remain manual.
- GitHub-native update automation can cover npm packages, GitHub Actions, and Dockerfiles, but it does not natively update the pinned support-image digests in `ops/kubernetes/immutable-stack.yaml`; this repository now covers that gap with a custom scheduled workflow.

What is already automated
-------------------------

- CI, test, lint, dependency audit, image scanning, and SBOM freshness enforcement already run through GitHub Actions.
- Dependabot is configured in `.github/dependabot.yml` to open update PRs against `main` for npm dependencies, GitHub Actions, and the root Dockerfile base images.
- `.github/workflows/itsg33-k8s-support-image-refresh.yml` now refreshes the pinned `mongo` and `nginx` `linux/amd64` support-image digests and opens a pull request when upstream digests change.
- `.github/workflows/itsg33-release-evidence.yml` now rolls up required workflow status into a PR comment and artifact whenever the required security or CI workflows complete for a pull request.
- `.github/workflows/itsg33-monthly-review.yml`, `.github/workflows/itsg33-quarterly-review.yml`, and `.github/workflows/itsg33-annual-review.yml` now open the recurring ITSG-33 review issues automatically on schedule.
- `npm run itsg33:repo-checks` now enforces digest-pinned Kubernetes support images and the presence of the required ITSG-33 artifacts through CI.
- The release evidence path already has a required structure through `.github/pull_request_template.md`.
- Monthly, quarterly, and annual evidence records already have issue forms under `.github/ISSUE_TEMPLATE`.
- The local Kubernetes baseline already enforces immutable support-image pins and support-container resource bounds.

What can be fully automated
---------------------------

Release evidence rollup

- The candidate commit SHA can be captured automatically from the workflow context.
- Workflow run URLs can be generated automatically for the current PR or commit.
- SBOM verification, dependency audit, and image scan results can be published into a generated evidence summary.
- A workflow can fail if the evidence summary job cannot confirm that the required checks passed.

Suggested implementation

- Add `.github/workflows/itsg33-release-evidence.yml` triggered on pull requests.
- Add `scripts/collect-itsg33-release-evidence.js` to call the GitHub API, gather required check results, and emit a Markdown summary.
- Publish the summary as a workflow artifact and append it to the job summary.
- Optionally comment on the PR with the latest evidence rollup.

Recurring issue creation and reminders

- Monthly, quarterly, and annual review issues can be created automatically on a schedule.
- Labels, assignees, due-date conventions, and milestone naming can be applied automatically.
- The issue body can be prefilled with links to the relevant docs, latest workflow runs, and the current review period.

Suggested implementation

- Add scheduled workflows such as `.github/workflows/itsg33-monthly-review.yml`, `.github/workflows/itsg33-quarterly-review.yml`, and `.github/workflows/itsg33-annual-review.yml`.
- Use `actions/github-script` or the GitHub CLI to create or update the corresponding issue.
- Add standard labels such as `itsg33`, `evidence`, `monthly-review`, `quarterly-review`, and `annual-review`.

Baseline drift checks

- Kubernetes manifests can be checked automatically to ensure support images remain digest-pinned.
- Workflow versions can be checked automatically to ensure actions remain pinned to approved release tags.
- Documentation references can be linted to ensure required ITSG-33 docs still exist.

Suggested implementation

- Add `scripts/check-k8s-image-pins.js` to fail when mutable support-image tags reappear.
- Add a lightweight doc-link checker in CI for the ITSG-33 docs.
- Keep `.github/dependabot.yml` for npm, GitHub Actions, and Dockerfile updates.
- Keep `.github/workflows/itsg33-k8s-support-image-refresh.yml` for automatic pull requests that refresh the pinned support-image digests in `ops/kubernetes/immutable-stack.yaml`.

What can be partially automated
-------------------------------

Monthly security review

- A scheduled workflow can open the issue automatically.
- A health-check script can query a protected environment and capture the `immutableLogging` state if a read-only token and endpoint URL are available.
- Vulnerability data can be summarized from the latest audit and Trivy artifacts.
- A privileged-access report can be generated automatically if the application database or identity provider exposes a safe read-only export path.

Human step that remains

- A reviewer must interpret unusual audit events, decide whether findings are acceptable, and confirm secret-rotation rationale.

Suggested implementation

- Add `scripts/check-audit-health.js` to call the protected `/healthz` endpoint.
- Add `scripts/export-privileged-access-report.js` to read current `admin` and `break_glass` assignments.
- Post the generated report links into the monthly review issue.

Backup and restore exercise

- A workflow can provision or target an isolated recovery environment.
- Restore steps can be scripted and timed automatically.
- Smoke tests can verify startup, authentication surface, and a representative protected route.
- Results can be attached automatically to the corresponding quarterly issue.

Human step that remains

- An operator must approve the exercise, verify that the scenario is realistic, and judge whether the measured recovery time and recovery point are acceptable.

Suggested implementation

- Add `.github/workflows/itsg33-backup-restore-drill.yml` with manual dispatch and optional schedule.
- Gate execution behind a protected environment approval.
- Emit restore duration, test results, and artifact links into the quarterly issue.

Break-glass drill

- In staging or another non-production environment, a workflow can execute a scripted emergency-mode drill, verify health, capture audit evidence, and reset the mode automatically.
- The evidence package can be attached automatically to the issue.

Human step that remains

- A privileged operator must authorize the drill, confirm the scenario, and review the audit trail. Production break-glass must remain manual.

Suggested implementation

- Add `.github/workflows/itsg33-break-glass-drill.yml` for non-production use only.
- Require environment approval before the workflow can run.
- Refuse execution when the target environment is production.

Privileged-access review

- A scheduled workflow can export current privileged assignments, compare them with the previous period, and attach a diff artifact to the review issue.

Human step that remains

- A reviewer must validate business justification, approve removals or retention, and confirm offboarding implications.

Suggested implementation

- Add `.github/workflows/itsg33-privileged-access-review.yml`.
- Store an artifact containing the current privileged-role report and a comparison against the last completed review.

Annual governance refresh

- A scheduled workflow can open the annual issue automatically.
- The workflow can summarize security-document changes, workflow changes, branch-protection doc changes, and major security-related PRs since the last review.

Human step that remains

- A designated owner must confirm inherited controls, sign off on risk decisions, and record authorization outcomes.

Suggested implementation

- Add `scripts/collect-governance-diff.js` to gather `git log` output for the relevant docs and workflow paths.
- Attach the resulting summary to the annual governance issue.

What cannot be fully automated
------------------------------

Personnel Security (`PS`)

- Background screening, training completion, onboarding, offboarding, and management attestation may be reminder-tracked from the repo, but the authoritative records belong in HR or an internal governance system.

Physical and Environmental Protection (`PE`)

- Facility controls, provider attestations, and environmental protections can be referenced from the repo, but the evidence belongs in the hosting-provider record or internal infrastructure assurance package.

Media Protection (`MP`)

- The repo can remind operators to confirm backup encryption and export-handling policy, but actual storage controls, retention controls, and disposal procedures live in platform and operational systems.

Governance, Planning, Risk, and Assessment (`PM`, `PL`, `RA`, `CA`)

- The repo can create annual reminders and prefill summaries, but risk acceptance, authorization, and assessment sign-off remain human governance actions.

Recommended implementation order
--------------------------------

Phase 1: repo-only automation

- Completed: recurring issue-creation workflows.
- Completed: release-evidence rollup workflow.
- Completed: CI checks for digest-pinned support images and required ITSG-33 docs.
- Completed: Dependabot coverage for npm, GitHub Actions, and Dockerfile updates.
- Completed: custom digest-refresh workflow for Kubernetes support-image PRs.

Phase 2: environment-integrated automation

- Add protected-environment health checks.
- Add privileged-access export and diff reporting.
- Add an isolated backup and restore drill workflow.

Phase 3: governed operational automation

- Add a non-production break-glass drill workflow with approval gates.
- Integrate recurring evidence issues with the internal ticket or GRC system if one exists.
- Add owner-specific reminders for provider attestation and inherited-control refresh.

Guardrails
----------

- Never auto-close evidence issues without human review.
- Never auto-approve residual risk or privileged access.
- Never run break-glass or restore drills in production without an explicit human gate.
- Keep sensitive evidence outside the repository when policy or classification requires it.

Definition of success
---------------------

This repository should aim for the following end state:

- GitHub automatically creates the required recurring evidence issues.
- Pull requests automatically receive a release evidence rollup.
- Environment-integrated workflows attach health, restore, and privileged-access artifacts where safe to do so.
- Human reviewers make the approval and risk decisions, then link the authoritative records.
- External control evidence remains traceable from the repository, even when the evidence itself lives elsewhere.