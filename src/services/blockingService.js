const crypto = require('crypto');

const BLOCK_URL = process.env.BLOCK_WEBHOOK_URL || '';
const BLOCK_SECRET = process.env.BLOCK_WEBHOOK_SECRET || '';

const hasConfig = () => BLOCK_URL && BLOCK_SECRET;

async function sendBlockRequest(payload) {
    if (!hasConfig()) {
        console.warn('[blocking] webhook not configured; skipping');
        return { skipped: true };
    }

    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', BLOCK_SECRET).update(body).digest('hex');

    try {
        // Use global fetch (Node 18+). Keep the request minimal and idempotent.
        const res = await fetch(BLOCK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-block-signature': signature
            },
            body
        });

        const text = await res.text();
        return { ok: res.ok, status: res.status, body: text };
    } catch (err) {
        console.error('[blocking] request failed', err);
        return { error: String(err) };
    }
}

async function sendBlockRequestsForAlerts(alerts = []) {
    const results = [];
    for (const alert of alerts) {
        // Attempt to derive a target to block (common keys: ip, src, target)
        const details = alert.details || {};
        const target = details.ip || details.src || details.target || null;
        if (!target) {
            results.push({ alertId: alert._id || alert.id || null, skipped: true, reason: 'no-target' });
            continue;
        }

        const payload = {
            action: 'block',
            target,
            reason: `${alert.type} - ${alert.summary || ''}`,
            alert: {
                id: alert._id || alert.id || null,
                type: alert.type,
                severity: alert.severity,
                detectedAt: alert.detectedAt || alert.createdAt || new Date().toISOString()
            }
        };

        const res = await sendBlockRequest(payload);
        results.push({ alertId: payload.alert.id, target, result: res });
    }

    return results;
}

module.exports = {
    sendBlockRequest,
    sendBlockRequestsForAlerts
};
