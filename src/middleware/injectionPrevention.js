const { inspectRequestInput } = require('../services/injectionPreventionService');

function isApiRequest(req = {}) {
    return String(req.path || '').startsWith('/api/')
        || (typeof req.get === 'function' && String(req.get('accept') || '').includes('application/json'));
}

function formatFinding(finding = {}) {
    return `${finding.surface}.${finding.path}: ${finding.reason}`;
}

function enforceInjectionPrevention(req, res, next) {
    const inspection = inspectRequestInput({
        body: req.body,
        query: req.query,
        params: req.params
    });

    if (!inspection.blocked) {
        return next();
    }

    if (isApiRequest(req)) {
        return res.status(400).json({
            success: false,
            message: 'Rejected potentially unsafe request input',
            errors: inspection.findings.map(formatFinding),
            data: {
                blocked: true,
                findings: inspection.findings
            }
        });
    }

    return res.status(400).send('Rejected potentially unsafe request input');
}

module.exports = {
    enforceInjectionPrevention
};
