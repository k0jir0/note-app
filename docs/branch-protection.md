Branch protection and recommended workflow
=====================================

Recommended policy (summary):

- Use feature branches and open Pull Requests to merge into `main`.
- Require at least one approving review (`CODEOWNERS` helps route reviews).
- Require passing CI status checks (use the `CI` workflow: `lint-and-test`).
- Require branches to be up-to-date before merging (prevents merge commits and ensures checks run on combined changes).

How to enable protections (GitHub UI):

1. Go to your repository on GitHub → Settings → Branches → Branch protection rules.
2. Create a rule for branch `main`.
3. Enable: "Require pull request reviews before merging" and set the required approval count (e.g., 1).
4. Enable: "Require status checks to pass before merging" and select `Lint and Test` checks (these appear after the workflow runs at least once).
5. Optionally enable: "Require branches to be up to date before merging".

CLI / API examples (requires `gh` or token):

Using the GitHub CLI (`gh`):

```bash
# set required checks and require PR reviews (replace owner/repo)
gh api --method PUT /repos/OWNER/REPO/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["Lint and Test"]}' \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"required_approving_review_count":1}'
```

Using the REST API (curl) — replace `TOKEN`, `OWNER`, `REPO`:

```bash
curl -X PUT -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer TOKEN" \
  https://api.github.com/repos/OWNER/REPO/branches/main/protection \
  -d '{
    "required_status_checks": {"strict": true, "contexts": ["Lint and Test"]},
    "required_pull_request_reviews": {"dismiss_stale_reviews": true, "required_approving_review_count": 1},
    "enforce_admins": false
  }'
```

Notes:
- The workflow must run at least once so GitHub knows the status check names to select in branch protection.
- If you enable "enforce_admins", admins will also be blocked by the rule; consider leaving it off until the team is ready.
- If you need to preserve previous branch names or history, archive them before making disruptive changes.
