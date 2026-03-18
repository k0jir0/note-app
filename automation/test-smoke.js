const { parseFalcoJson } = require('../src/utils/intrusionParser');
const fs = require('fs');
const path = require('path');

(async function main() {
    try {
        const p = path.join(__dirname, 'sample-security.log');
        const txt = fs.readFileSync(p, 'utf8');
        const res = parseFalcoJson(txt);
        console.log('linesAnalyzed:', res.linesAnalyzed);
        console.log('eventsParsed:', Array.isArray(res.events) ? res.events.length : 0);
        if (res.events && res.events.length > 0) {
            console.log('sampleEvent:', JSON.stringify(res.events[0], null, 2));
        } else {
            console.log('No events parsed (this file may not be Falco JSON lines).');
        }
    } catch (e) {
        console.error('smoke test failed:', e && e.message ? e.message : e);
        process.exitCode = 2;
    }
})();
