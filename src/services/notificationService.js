const fetch = global.fetch || require('node-fetch');
let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    // nodemailer is optional for local tests; functions will no-op if not available
    nodemailer = null;
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || '';

async function sendSlackMessage(text) {
    if (!SLACK_WEBHOOK_URL) return { skipped: true };
    try {
        const res = await fetch(SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        return { ok: res.ok, status: res.status };
    } catch (e) {
        return { error: String(e) };
    }
}

async function sendEmail(subject, text) {
    if (!SMTP_HOST || !ALERT_EMAIL_TO || !nodemailer) return { skipped: true };
    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT || 587,
            secure: SMTP_PORT === 465,
            auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
        });

        const info = await transporter.sendMail({
            from: SMTP_USER || `no-reply@${process.env.HOSTNAME || 'localhost'}`,
            to: ALERT_EMAIL_TO,
            subject,
            text
        });
        return { ok: true, info };
    } catch (e) {
        return { error: String(e) };
    }
}

async function notifyAlertsSummary(alerts = []) {
    if (!alerts.length) return { skipped: true };
    const high = alerts.filter((a) => a.severity === 'high').length;
    const medium = alerts.filter((a) => a.severity === 'medium').length;
    const low = alerts.filter((a) => a.severity === 'low').length;
    const subject = `Security Alerts: ${alerts.length} new (${high} high)`;
    const text = `New alerts detected:\n- High: ${high}\n- Medium: ${medium}\n- Low: ${low}\n\nSample: ${alerts[0] && alerts[0].summary ? alerts[0].summary : ''}`;

    const results = {};
    results.slack = await sendSlackMessage(`${subject}\n${text}`);
    results.email = await sendEmail(subject, text);
    return results;
}

async function notifyScanImport(parsedScan, result) {
    if (!parsedScan) return { skipped: true };
    const subject = `Scan Imported: ${parsedScan.tool} ${parsedScan.target} - ${result.findingsCount || 0} findings`;
    const text = `${subject}\nSummary: ${result.summary || parsedScan.summary || ''}`;
    const results = {};
    results.slack = await sendSlackMessage(`${subject}\n${text}`);
    results.email = await sendEmail(subject, text);
    return results;
}

module.exports = {
    sendSlackMessage,
    sendEmail,
    notifyAlertsSummary,
    notifyScanImport
};
