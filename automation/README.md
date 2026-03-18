Security automation runners

This folder contains small helper scripts to run external scanners and write their output to files
that the application `automationService` can ingest via `scanBatch` and `intrusionBatch`.

1) Trivy runner
- Configure environment variables:
  - `TRIVY_CMD` (required) — full command to run Trivy, e.g. `trivy image --format json --quiet nginx:latest`
  - `TRIVY_OUTPUT_PATH` (optional) — file to write JSON output (default: automation/trivy-output.json)
  - `TRIVY_INTERVAL_MS` (optional) — if set, runner will repeat at this interval (ms)

Run:
```bash
TRIVY_CMD="trivy image --format json --quiet nginx:latest" TRIVY_OUTPUT_PATH=./automation/trivy-output.json node automation/trivy-runner.js
```

2) Falco runner
- Configure environment variables:
  - `FALCO_CMD` (optional) — default `falco -o json`; can be any command that emits JSON lines
  - `FALCO_OUTPUT_PATH` (optional) — file to append Falco JSON lines to (default: automation/falco-output.log)

Run:
```bash
FALCO_CMD="falco -o json" FALCO_OUTPUT_PATH=./automation/falco-output.log node automation/falco-runner.js
```

Notes
- These scripts do not install or manage the scanner binaries or containers — run them on a host
  where `trivy`, `docker`, or `falco` are available, or set `TRIVY_CMD`/`FALCO_CMD` to a container
  invocation (e.g., `docker run --rm ...`).
- The application `runtimeConfig` must point `SCAN_BATCH_FILE_PATH` or `INTRUSION_BATCH_FILE_PATH`
  to the output files these runners write so the automation service will ingest them.
