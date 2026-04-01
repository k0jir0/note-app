ITSG-33 Operations Runbook
==========================

Purpose
-------

This runbook turns the residual ITSG-33 obligations into repeatable operating procedures that fit the current repository and deployment model.

1. Release Security Gate
------------------------

Objective

- Confirm that the release candidate meets the enforced repository controls and that the evidence package is complete.

Procedure

1. Confirm the branch and PR state.
2. Run the local verification commands relevant to the change:
   - `npm run lint`
   - `npm test`
   - `npm run audit:deps`
   - `npm run audit:prod`
   - `npm run sbom:check`
3. Confirm the required GitHub checks are green for the candidate commit.
4. If dependencies changed, confirm `sbom/note-app.cdx.json` was regenerated and reviewed.
5. Complete the pull request template evidence section and link any related recurring-control issues.
6. Save the evidence package listed in `docs/itsg33-evidence-checklist.md`.

Completion criteria

- All required checks are green.
- The SBOM check passes.
- The evidence package is attached to the PR, release record, or change ticket.

2. Audit Sink Degradation Response
----------------------------------

Objective

- Detect and respond when immutable audit delivery is degraded.

Procedure

1. Query the protected environment health endpoint and inspect the `immutableLogging` object.
2. If `degraded` is `true`, determine whether the sink outage is transient or persistent.
3. Review recent app logs and audit-sink connectivity for errors.
4. If the environment requires remote forwarding for continued operation, halt promotion or declare the system degraded until forwarding is restored.
5. After recovery, confirm the health endpoint reports `healthy: true` and `degraded: false`.
6. Record the follow-up in the `Monthly Security Review` issue form if the degradation affected evidence or release readiness.

Completion criteria

- Root cause is documented.
- Recovery timestamp is recorded.
- A post-recovery health check is captured as evidence.

3. Break-Glass Activation and Recovery
--------------------------------------

Objective

- Use break-glass controls in a controlled, reviewable way during incident response or emergency maintenance.

Procedure

1. Confirm the operator has the required `admin` or `break_glass` role.
2. Perform a recent hardware-first MFA step-up.
3. Record the incident or maintenance ticket identifier before making the change.
4. Use the break-glass control path in the application to set the required mode and reason.
5. Verify the resulting state using the application control view and, if relevant, `GET /healthz`.
6. Once the incident or maintenance action is complete, return the system to `disabled` mode and capture the restoration timestamp.
7. Review the audit trail for both the activation and the reset.
8. Open or update the `Break-Glass Drill` issue form with the scenario, timestamps, and evidence links.

Completion criteria

- Activation and reset were both audited.
- The reason and ticket identifier are recorded.
- The system returns to the expected steady-state mode.

4. Backup and Restore Exercise
------------------------------

Objective

- Satisfy the contingency-planning controls that the repository cannot enforce directly.

Procedure

1. Identify the authoritative backup source for the production or staging data store.
2. Restore the backup into an isolated test environment.
3. Validate at minimum:
   - Application starts successfully.
   - Authentication surface responds.
   - A representative protected route responds for an authorized user.
4. Record restore duration, issues encountered, and any manual steps required.
5. Open or update the `Backup and Restore Exercise` issue form with evidence and restore timing.
6. Open follow-up work for any undocumented steps or restore failures.

Completion criteria

- Restore completed successfully in the defined target environment.
- Recovery timing and manual steps are documented.
- Corrective actions are filed for any deficiencies.

5. Quarterly Privileged Access Review
-------------------------------------

Objective

- Ensure only justified users retain privileged roles.

Procedure

1. Export or review all users with `admin` or `break_glass` authority.
2. Confirm each assignment still has a business justification.
3. Remove or downgrade any stale or unnecessary privilege.
4. Review recent privileged-denial audit events for unusual patterns.
5. Record the reviewer, date, and decisions made in the `Privileged Access Review` issue form.

Completion criteria

- A dated privileged-access attestation exists.
- Removals or changes were completed or tracked.

6. Annual Governance Refresh
----------------------------

Objective

- Keep the technical review aligned with the broader ITSG-33 control package.

Procedure

1. Review `docs/itsg33-review.md` for outdated assumptions.
2. Update `docs/itsg33-control-matrix.md` if controls, owners, or evidence expectations changed.
3. Reconfirm hosting, physical, personnel, and media-protection inheritance with the appropriate owner.
4. Refresh the risk record or system security plan for major architecture, auth, or hosting changes.
5. Record the outcome in the `Annual Governance Refresh` issue form.

Completion criteria

- Review docs are current.
- The latest risk and control decisions are recorded.

Notes
-----

- This repository provides technical evidence for many control families, but it does not replace platform, personnel, facility, or departmental governance controls.
- Use these procedures together with `docs/itsg33-evidence-checklist.md` when preparing assessment evidence.