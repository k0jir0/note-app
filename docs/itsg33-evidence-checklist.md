ITSG-33 Evidence Checklist
==========================

Purpose
-------

Use this checklist when preparing a release, conducting a periodic review, or assembling evidence for an internal control assessment.
Use the pull request template for release evidence and the issue forms under `.github/ISSUE_TEMPLATE` for the recurring monthly, quarterly, and annual records.

Per Release or Pull Request
---------------------------

- [ ] Record the branch name, PR link, merge commit, and release candidate commit SHA.
- [ ] Confirm required GitHub checks are green:
  - `CI / Lint and Test`
  - `Security CI / SAST`
  - `Security CI / Run tests`
  - `Security CI / DAST`
  - `Security Scan CI / trivy-scan`
  - `Dependency Audit / audit`
- [ ] Capture the `npm run sbom:check` result.
- [ ] Capture the `npm run audit:deps` and `npm run audit:prod` results.
- [ ] Confirm the committed `sbom/helios.cdx.json` file is part of the reviewed state when dependency changes occurred.
- [ ] Confirm the final PR includes any required docs or runbook updates.
- [ ] If the change affects deployment or emergency controls, capture a staging verification result.

Suggested evidence

- GitHub Actions run URLs
- Console output for `npm run sbom:check`
- PR URL and merge commit
- Trivy and npm audit artifacts
- The completed pull request template sections for evidence, staging verification, and related control records

Monthly
-------

- [ ] Review high-risk audit events, including privileged-runtime denials and break-glass changes.
- [ ] Check whether any environment reports `immutableLogging.degraded`.
- [ ] Review open dependency and image findings that were accepted or deferred.
- [ ] Review current `admin` and `break_glass` assignments.
- [ ] Confirm secrets or OAuth credentials scheduled for monthly rotation were rotated.

Suggested evidence

- Audit event export or screenshots
- Health endpoint result from the protected environment
- Role review notes
- Ticket or change log for rotated secrets
- The completed `Monthly Security Review` issue form

Quarterly
---------

- [ ] Perform a backup and restore exercise for the deployed data store and supporting secrets.
- [ ] Perform a break-glass drill, including activation, verification, rollback, and evidence capture.
- [ ] Review hosting, ingress, and TLS assumptions against the current deployment.
- [ ] Review whether any privileged access exception is still justified.
- [ ] Review CI action versions, container base images, and workflow pins for currency.

Suggested evidence

- Restore drill notes with timestamps and success criteria
- Quarterly backup/restore workflow artifact or workflow comment link
- Break-glass drill record
- Infrastructure review notes
- Exception register review
- Workflow or dependency refresh PRs
- The completed `Backup and Restore Exercise`, `Break-Glass Drill`, and `Privileged Access Review` issue forms

Annual or Major Change
----------------------

- [ ] Refresh the ITSG-33 control review and update `docs/itsg33-review.md` if the architecture changed.
- [ ] Update `docs/itsg33-control-matrix.md` ownership, evidence expectations, and residual status.
- [ ] Revalidate system categorization, risk assumptions, and hosting-provider control inheritance.
- [ ] Review personnel, physical, and media-protection evidence with the relevant owner.
- [ ] Review branch protection, deployment authorization, and emergency operating procedures.

Suggested evidence

- Updated review and matrix docs
- Risk review or architecture decision record
- Hosting-provider attestation or internal infrastructure review
- Annual access review and security training record
- The completed `Annual Governance Refresh` issue form

Minimum Evidence Package for This Repository
--------------------------------------------

For a compact but defensible package, retain at least the following:

- Latest green workflow run URLs for the six required checks
- Current `sbom/helios.cdx.json` committed in git
- Passing `npm run sbom:check` output
- Passing dependency audit output
- One sample of a persisted audit event or authorization-denial audit event
- One protected-environment `/healthz` response that includes immutable logging status
- Latest privileged-access review record
- Latest backup or restore exercise record