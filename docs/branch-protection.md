Branch protection and recommended workflow
=====================================

Recommended policy (summary):

- Use feature branches and open Pull Requests to merge into `main`.
- For a solo-maintainer repo, do not require approving reviews.
- Require passing CI and security status checks before merging.
- Require branches to be up-to-date before merging (prevents merge commits and ensures checks run on combined changes).

How to enable protections (GitHub UI):

1. Go to your repository on GitHub → Settings → Branches → Branch protection rules.
2. Create a rule for branch `main`.
3. Enable: "Require a pull request before merging" but leave the required approval count at `0` for a solo-maintainer repository.
4. Enable: "Require status checks to pass before merging" and select the pull-request checks that always run for `main`.
5. Suggested required checks for this repository: `Lint and Test`, `audit`, `SAST`, `Run tests`, `DAST`, `trivy-scan`.
5. Optionally enable: "Require branches to be up to date before merging".

CLI / API examples (requires `gh` or token):

Using the GitHub CLI (`gh`):

```bash
# set required checks and require a PR without requiring approvals (replace owner/repo)
gh api --method PUT /repos/OWNER/REPO/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["Lint and Test","audit","SAST","Run tests","DAST","trivy-scan"]}' \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":0}'
```

Using the REST API (curl) — replace `TOKEN`, `OWNER`, `REPO`:

```bash
curl -X PUT -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer TOKEN" \
  https://api.github.com/repos/OWNER/REPO/branches/main/protection \
  -d '{
    "required_status_checks": {"strict": true, "contexts": ["Lint and Test", "audit", "SAST", "Run tests", "DAST", "trivy-scan"]},
    "required_pull_request_reviews": {"dismiss_stale_reviews": true, "require_code_owner_reviews": false, "required_approving_review_count": 0},
    "enforce_admins": false
  }'
```

Notes:
- The workflow must run at least once so GitHub knows the status check names to select in branch protection.
- `CODEOWNERS` can still stay in the repository for ownership metadata even when code owner review is not required.
- If you enable "enforce_admins", admins will also be blocked by the rule; consider leaving it off for a solo-maintainer repo.
- If you need to preserve previous branch names or history, archive them before making disruptive changes.
