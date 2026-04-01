CI/CD Security Gate Examples

This folder contains example CI configurations and notes for gating builds based on security scans.

- `.github/workflows/security-scan.yml` — Example GitHub Actions job using the official Trivy Action to scan a docker image and fail on HIGH/CRITICAL severity issues.

How to adapt:
- Replace the `image-ref` with the container you want to scan (your app image built in CI).
- Adjust `exit-code` rules according to your policy (e.g., fail on CRITICAL only).
- Add upload or annotation steps to provide feedback to PRs.

Local testing:
Run the `trivy-runner` locally and point `SCAN_BATCH_FILE_PATH` at the output file so the app ingests the results.

