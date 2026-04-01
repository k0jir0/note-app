const { buildMongooseInjectionPosture, inspectRequestInput } = require('./injectionPreventionService');

const SAMPLE_SCENARIOS = [
    {
        id: 'nosql-operator-body',
        label: 'NoSQL Operator In JSON Body',
        summary: 'A request body attempts to smuggle a Mongo operator so the query layer matches too much.',
        surface: 'body',
        payload: {
            title: 'Probe note',
            user: {
                $ne: null
            }
        }
    },
    {
        id: 'nested-query-selector',
        label: 'Nested Query Selector',
        summary: 'A query-string parser turns bracket notation into an operator-shaped object.',
        surface: 'query',
        payload: {
            limit: {
                $gt: 0
            }
        }
    },
    {
        id: 'validated-owned-note-query',
        label: 'Validated Owned-Note Query',
        summary: 'A normal request carries only scalar values and is reduced to an exact-match ownership filter.',
        surface: 'body',
        payload: {
            title: 'Mission note',
            content: 'Validated note content'
        }
    }
];

const CONTROL_GUIDANCE = [
    {
        id: 'structured-query-builders',
        label: 'Structured query builders',
        description: 'Controllers should build fixed query shapes in code instead of letting raw request objects flow into Mongoose filters or updates.'
    },
    {
        id: 'operator-key-blocking',
        label: 'Operator-key blocking',
        description: 'Request middleware should reject keys like $ne, $where, or dotted path keys before they reach the data layer.'
    },
    {
        id: 'sanitize-filter',
        label: 'Mongoose sanitizeFilter',
        description: 'Enable sanitizeFilter so unexpected selector objects are neutralized even if a filter escapes validation.'
    },
    {
        id: 'strict-query',
        label: 'Strict query mode',
        description: 'Enable strictQuery so unknown filter paths are stripped instead of broadening query intent silently.'
    },
    {
        id: 'field-allowlists',
        label: 'Field allowlists',
        description: 'Mutation builders should whitelist permitted fields so attacker-controlled payload keys never become update instructions.'
    }
];

const SAFE_QUERY_PATTERNS = [
    {
        id: 'owned-note-read',
        label: 'Owned note read',
        intent: 'Read one note only if it belongs to the authenticated user.',
        route: '/api/notes/:id',
        queryShape: {
            _id: '<validatedObjectId>',
            user: '<sessionUserId>'
        }
    },
    {
        id: 'owned-alert-feedback-update',
        label: 'Owned alert feedback update',
        intent: 'Update one alert only if it belongs to the authenticated user.',
        route: '/api/security/alerts/:id/feedback',
        queryShape: {
            _id: '<validatedObjectId>',
            user: '<sessionUserId>'
        }
    }
];

function normalizeBaseUrl(baseUrl = '') {
    const value = String(baseUrl || '').trim();
    return value ? value.replace(/\/+$/, '') : 'http://localhost:3000';
}

function listInjectionScenarios() {
    return SAMPLE_SCENARIOS.map((scenario) => ({
        ...scenario,
        payload: JSON.parse(JSON.stringify(scenario.payload))
    }));
}

function getInjectionScenario(scenarioId = '') {
    return listInjectionScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

function evaluateInjectionScenario({ scenarioId, surface, payload } = {}) {
    const scenario = getInjectionScenario(scenarioId) || null;
    const selectedSurface = ['body', 'query', 'params'].includes(String(surface || '').trim().toLowerCase())
        ? String(surface).trim().toLowerCase()
        : (scenario ? scenario.surface : 'body');
    const effectivePayload = payload && typeof payload === 'object'
        ? payload
        : (scenario ? scenario.payload : {});
    const inspection = inspectRequestInput({
        body: selectedSurface === 'body' ? effectivePayload : {},
        query: selectedSurface === 'query' ? effectivePayload : {},
        params: selectedSurface === 'params' ? effectivePayload : {}
    });

    return {
        scenario: scenario || {
            id: 'custom-injection-scenario',
            label: 'Custom Injection Scenario',
            summary: 'A custom request-shape evaluation built from the supplied payload.'
        },
        surface: selectedSurface,
        blocked: inspection.blocked,
        decision: inspection.blocked ? 'reject' : 'allow',
        summary: inspection.summary,
        findings: inspection.findings,
        safeAlternative: {
            principle: 'Build the database filter in code from validated scalar fields only.',
            example: {
                _id: '<validatedObjectId>',
                user: '<sessionUserId>'
            }
        }
    };
}

function buildInjectionPreventionModuleOverview({ baseUrl, mongooseLib } = {}) {
    const scenarios = listInjectionScenarios();
    const defaultScenario = scenarios[0];
    const mongoosePosture = buildMongooseInjectionPosture(mongooseLib);

    return {
        module: {
            name: 'Query Injection Prevention Module',
            focus: 'Architectural defenses against SQL-style and NoSQL operator injection',
            route: '/injection-prevention/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        database: {
            engine: 'MongoDB',
            accessLayer: mongoosePosture.orm,
            equivalentControl: 'Structured Mongoose filters and updates instead of raw request-driven query documents.',
            posture: mongoosePosture
        },
        controls: CONTROL_GUIDANCE.map((control) => ({ ...control })),
        queryPatterns: SAFE_QUERY_PATTERNS.map((pattern) => ({
            ...pattern,
            queryShape: { ...pattern.queryShape }
        })),
        scenarios,
        defaultScenarioId: defaultScenario.id,
        defaultEvaluation: evaluateInjectionScenario({
            scenarioId: defaultScenario.id
        })
    };
}

module.exports = {
    buildInjectionPreventionModuleOverview,
    evaluateInjectionScenario,
    getInjectionScenario,
    listInjectionScenarios
};
