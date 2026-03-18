#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// Generic Trivy runner: runs a configured command and writes stdout to an output file.
// Environment variables:
// - TRIVY_CMD: full command to run (default tries `trivy image --quiet --format json <IMAGE>` but must include image)
// - TRIVY_OUTPUT_PATH: where to write JSON output
// - TRIVY_INTERVAL_MS: optional interval to run repeatedly (ms)

const cmd = process.env.TRIVY_CMD || '';
const outPath = process.env.TRIVY_OUTPUT_PATH || path.join(__dirname, 'trivy-output.json');
const intervalMs = Number(process.env.TRIVY_INTERVAL_MS || 0);

async function writeAtomic(targetPath, data) {
    const tmp = `${targetPath}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, targetPath);
}

function runOnce() {
    if (!cmd) {
        console.error('TRIVY_CMD not set. Set a command like: trivy image --format json --quiet <image>');
        process.exitCode = 2;
        return;
    }

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout, stderr) => {
        if (err) {
            console.error('trivy-runner: command failed', err.message || err);
            if (stderr) console.error(stderr);
            return;
        }

        try {
            await writeAtomic(outPath, stdout || '');
            console.log(`trivy-runner: wrote output to ${outPath}`);
        } catch (e) {
            console.error('trivy-runner: write failed', e && e.message ? e.message : e);
        }
    });
}

if (intervalMs > 0) {
    runOnce();
    setInterval(runOnce, intervalMs).unref();
} else {
    runOnce();
}
