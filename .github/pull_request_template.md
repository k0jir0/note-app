## Summary

Describe the change and the user-visible or operational impact.

## Validation

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run sbom:check`
- [ ] Relevant security workflows are green for the candidate commit

## ITSG-33 Evidence

- [ ] The required GitHub checks are green
- [ ] `sbom/helios.cdx.json` was reviewed or confirmed unchanged when dependencies did not change
- [ ] Deployment, emergency-control, or privileged-runtime changes include updated docs or runbook entries
- [ ] Staging verification was captured for deployment, audit, or emergency-control changes
- [ ] Related recurring-control records are linked when this PR depends on them

Candidate commit SHA:

Workflow run URLs:

Staging verification or protected-environment evidence:

Related ITSG-33 issue records:

## Risk Review

Operational follow-up, exceptions, or residual risks.