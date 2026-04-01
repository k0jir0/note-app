Rotation Lambda

This branch tracks the rotation Lambda feature work.

Relevant files
- `ops/terraform/rotation_lambda/index.js` — Lambda handler
- `ops/terraform/rotation_lambda/main.tf` — Terraform module
- `ops/terraform/rotation_lambda/deploy-rotation.ps1` — local deploy helper
- `ops/terraform/rotation_lambda/integration-test.ps1` — staging verification helper
- `.github/workflows/deploy-rotation-oidc.yml` — GitHub Actions OIDC deployment workflow
- `documents/rotation-runbook.md` — manual trigger, verification, rollback, and audit guide

Notes for contributors
- This is a feature branch with an open draft PR; keep changes small and push incremental commits.
- Do not commit generated artifacts such as `.terraform/`, `tfplan`, or zip bundles.
- Run `terraform init` in `ops/terraform/rotation_lambda` before planning locally.

Current checklist
- [x] Restore the Terraform module source files
- [x] Remove the wildcard KMS fallback and require a specific KMS key ARN
- [x] Add an OIDC deployment workflow and a staging integration script
- [x] Publish a short rotation runbook
- [ ] Run a staging deployment and verify the Lambda end-to-end
- [ ] Mark the draft PR ready for review after staging validation

