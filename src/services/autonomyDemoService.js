const SecurityAlert = require('../models/SecurityAlert');
const { getIncidentResponseConfig, executeIncidentResponses } = require('./incidentResponseService');

function buildDryRunNotificationOutcome() {
    return {
        slack: {
            skipped: true,
            reason: 'demo-dry-run'
        },
        email: {
            skipped: true,
            reason: 'demo-dry-run'
        }
    };
}

function buildDryRunBlockResults(alerts = []) {
    return alerts.map((alert) => ({
        alertId: alert._id || alert.id || null,
        target: alert.details && (alert.details.ip || alert.details.src || alert.details.target) || '',
        result: {
            skipped: true,
            reason: 'demo-dry-run'
        }
    }));
}

function buildAutonomyDemoAlerts(userId, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const config = options.config || getIncidentResponseConfig(options.env);
    const source = config.allowedSources[0] || 'realtime-ingest';

    return [
        {
            user: userId,
            source,
            type: 'injection_attempt',
            severity: 'high',
            summary: 'Autonomy demo: high-confidence injection attempt against a live target',
            details: {
                ip: '203.0.113.250',
                count: 14,
                ratio: 0.92,
                tools: ['sqlmap'],
                sourceIps: {
                    '203.0.113.250': 14
                },
                sample: [
                    'GET /search?q=\' OR 1=1-- 500 sqlmap/1.7',
                    'GET /login?user=admin\'-- 500 sqlmap/1.7'
                ],
                _fingerprint: 'autonomy-demo-block'
            },
            feedback: {
                label: 'unreviewed',
                updatedAt: now
            },
            mlScore: 0.97,
            mlLabel: 'high',
            mlReasons: [
                'Synthetic autonomy demo alert seeded above the block threshold',
                'Target includes a concrete IP so the block policy has an addressable subject'
            ],
            mlFeatures: {
                type: 'injection_attempt',
                severity: 'high',
                count: 14,
                threshold: 5,
                ratio: 0.92,
                sampleSize: 2,
                toolCount: 1,
                sourceIpCount: 1,
                summaryLength: 71,
                hasIpIndicator: true,
                hasFingerprint: true,
                feedbackLabel: 'unreviewed'
            },
            scoreSource: 'trained-logistic-regression+demo-seed',
            detectedAt: new Date(now.getTime() - 60 * 1000)
        },
        {
            user: userId,
            source,
            type: 'suspicious_path_probe',
            severity: 'medium',
            summary: 'Autonomy demo: suspicious path probing that should notify but not block',
            details: {
                ip: '198.51.100.44',
                count: 7,
                ratio: 0.58,
                tools: ['nikto'],
                sourceIps: {
                    '198.51.100.44': 7
                },
                sample: [
                    'GET /.env 404 Nikto/2.1.6',
                    'GET /phpmyadmin 404 Nikto/2.1.6'
                ],
                _fingerprint: 'autonomy-demo-notify'
            },
            feedback: {
                label: 'unreviewed',
                updatedAt: now
            },
            mlScore: 0.82,
            mlLabel: 'high',
            mlReasons: [
                'Synthetic autonomy demo alert seeded above the notify threshold',
                'Medium severity keeps it out of the automatic block path'
            ],
            mlFeatures: {
                type: 'suspicious_path_probe',
                severity: 'medium',
                count: 7,
                threshold: 5,
                ratio: 0.58,
                sampleSize: 2,
                toolCount: 1,
                sourceIpCount: 1,
                summaryLength: 67,
                hasIpIndicator: true,
                hasFingerprint: true,
                feedbackLabel: 'unreviewed'
            },
            scoreSource: 'trained-logistic-regression+demo-seed',
            detectedAt: now
        }
    ];
}

async function injectAutonomyDemo(userId, options = {}) {
    const alerts = buildAutonomyDemoAlerts(userId, options);
    const insertedAlerts = await SecurityAlert.insertMany(alerts);
    const responseOutcome = await executeIncidentResponses(insertedAlerts, {
        ...options,
        SecurityAlertModel: options.SecurityAlertModel || SecurityAlert,
        notifyAlertsSummaryFn: options.notifyAlertsSummaryFn || (async () => buildDryRunNotificationOutcome()),
        sendBlockRequestsForAlertsFn: options.sendBlockRequestsForAlertsFn || (async (eligibleAlerts) => buildDryRunBlockResults(eligibleAlerts))
    });

    const updatedAlerts = responseOutcome && Array.isArray(responseOutcome.alerts)
        ? responseOutcome.alerts
        : insertedAlerts;
    const levelCounts = updatedAlerts.reduce((summary, alert) => {
        const level = alert.response && alert.response.level ? alert.response.level : 'none';
        summary[level] = (summary[level] || 0) + 1;
        return summary;
    }, {});

    return {
        createdAlerts: updatedAlerts.length,
        levelCounts,
        alerts: updatedAlerts,
        mode: 'dry-run'
    };
}

module.exports = {
    buildAutonomyDemoAlerts,
    injectAutonomyDemo
};
