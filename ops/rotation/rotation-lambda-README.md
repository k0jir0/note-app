Rotation Lambda — scaffold

This branch contains scaffold and notes for the rotation lambda feature.

Contents
- `index.js` — lambda handler (not included here yet)
- `deploy-rotation.ps1` — deployment helper (already in repo when implemented)

Notes for contributors
- This branch is a feature branch; open PRs and request reviews. Do not push binaries into the repo.
- Terraform provider binaries and `.terraform/` directories are intentionally gitignored; run `terraform init` in module dirs to fetch providers.

Checklist
- [ ] Implement `index.js` lambda handler
- [ ] Add unit tests under `test/`
- [ ] Add deployment/CI steps and documentation

How to test locally
1. Install dependencies: `npm ci`
2. Run unit tests: `npm test`

If you need to add infra changes, update `ops/terraform/rotation_lambda` and follow the `ops/terraform/README.md` guidance.
