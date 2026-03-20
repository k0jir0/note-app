#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const fsSync = require('fs');

// Generic Trivy runner: runs a configured command and writes stdout to an output file.
// Environment variables:
// - TRIVY_CMD: full command to run (default tries `trivy image --quiet --format json <IMAGE>` but must include image)
// - TRIVY_OUTPUT_PATH: where to write JSON output
// - TRIVY_INTERVAL_MS: optional interval to run repeatedly (ms)

const cmd = process.env.TRIVY_CMD || '';
const outPath = process.env.TRIVY_OUTPUT_PATH || path.join(__dirname, 'trivy-output.json');
const intervalMs = Number(process.env.TRIVY_INTERVAL_MS || 0);

async function writeAtomicStream(targetPath, srcStream) {
    const tmp = `${targetPath}.${Date.now()}.tmp`;
    await new Promise((resolve, reject) => {
        const out = fsSync.createWriteStream(tmp, { encoding: 'utf8' });
        srcStream.pipe(out);
        srcStream.on('error', (err) => {
            out.destroy();
            reject(err);
        });
        out.on('finish', resolve);
        out.on('error', reject);
    });

    await fs.rename(tmp, targetPath);
}

function runOnce() {
    if (!cmd) {
        console.error('TRIVY_CMD not set. Set a command like: trivy image --format json --quiet <image>');
        process.exitCode = 2;
        return;
    }

    // Use spawn with shell to stream large outputs safely (avoids exec maxBuffer limits)
    const child = spawn(cmd, { shell: true });

    child.on('error', (err) => {
        console.error('trivy-runner: failed to start command', err && err.message ? err.message : err);
    });

    // Pipe stdout to an atomic file write
    try {
        await writeAtomicStream(outPath, child.stdout);
        console.log(`trivy-runner: wrote output to ${outPath}`);
    } catch (e) {
        console.error('trivy-runner: write failed', e && e.message ? e.message : e);
    }

    // Log any stderr output
    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
    });

    child.on('close', (code, signal) => {
        if (stderrBuf && stderrBuf.trim()) {
            console.error('trivy-runner stderr:', stderrBuf.trim());
        }
        if (code !== 0) {
            console.warn(`trivy-runner: process exited with code ${code}${signal ? `, signal ${signal}` : ''}`);
        }
    });
}

if (intervalMs > 0) {
    runOnce();
    setInterval(runOnce, intervalMs).unref();
} else {
    runOnce();
}
