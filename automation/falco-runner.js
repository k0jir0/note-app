#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// Falco runner: spawns a Falco process (or any command that emits JSON lines)
// and appends JSON lines to the configured output file.
// Environment variables:
// - FALCO_CMD: command to run (default: 'falco -o json')
// - FALCO_OUTPUT_PATH: path to write output lines

const falcoCmd = process.env.FALCO_CMD || 'falco -o json';
const outPath = process.env.FALCO_OUTPUT_PATH || path.join(__dirname, 'falco-output.log');

async function appendLine(line) {
    try {
        await fs.appendFile(outPath, line + '\n', 'utf8');
    } catch (e) {
        console.error('falco-runner: append failed', e && e.message ? e.message : e);
    }
}

function start() {
    const parts = falcoCmd.split(' ').filter(Boolean);
    const proc = spawn(parts[0], parts.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.setEncoding('utf8');
    let buffer = '';
    proc.stdout.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (line) appendLine(line);
        }
    });

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (d) => console.error('falco-runner stderr:', d.toString()));

    proc.on('exit', (code, signal) => {
        console.warn('falco-runner: process exited', { code, signal });
        // Do not auto-restart here; let orchestration handle it.
    });

    console.log('falco-runner: started process for command:', falcoCmd);
}

start();
