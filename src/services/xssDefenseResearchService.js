const fs = require('fs');
const path = require('path');

const {
    buildContentSecurityPolicyDirectives,
    escapeHtmlForRendering,
    summarizeDirectiveList
} = require('../config/xssDefense');
const { sanitizeString } = require('../utils/validation');

const SAMPLE_SCENARIOS = [
    {
        id: 'script-tag-note-title',
        label: 'Script Tag In Note Title',
        summary: 'Untrusted note input includes a script tag that should be neutralized by output escaping and blocked from execution by CSP.',
        payload: '<script>alert("xss")</script>Mission report'
    },
    {
        id: 'inline-event-handler',
        label: 'Inline Event Handler',
        summary: 'User-controlled markup attempts to smuggle an onerror handler into rendered HTML.',
        payload: '<img src="x" onerror="alert(1)">Field terminal'
    },
    {
        id: 'javascript-url-attempt',
        label: 'JavaScript URL Attempt',
        summary: 'Attacker-controlled content tries to inject a javascript: URL instead of a safe navigation target.',
        payload: '<a href="javascript:alert(1)">Open incident report</a>'
    },
    {
        id: 'safe-mission-summary',
        label: 'Safe Mission Summary',
        summary: 'Normal plain-text content should render safely without triggering XSS controls.',
        payload: 'Mission summary: review the latest scored alerts and export the approved report.'
    }
];

const CONTROL_GUIDANCE = [
    {
        id: 'escaped-server-rendering',
        label: 'Escaped server rendering',
        description: 'Server-rendered views should use escaped interpolation so untrusted content is encoded instead of interpreted as markup.'
    },
    {
        id: 'client-side-escape-helpers',
        label: 'Client-side escape helpers',
        description: 'Browser modules should escape dynamic values before they are inserted into DOM templates or alert and status surfaces.'
    },
    {
        id: 'strict-csp',
        label: 'Strict Content Security Policy',
        description: 'The app should emit a CSP that limits scripts to self-hosted assets and blocks inline script attributes.'
    },
    {
        id: 'inline-script-ban',
        label: 'Inline script ban',
        description: 'Page templates should avoid inline script blocks and event-handler attributes so the CSP can stay strict.'
    },
    {
        id: 'input sanitization for note fields',
        label: 'Input sanitization for note fields',
        description: 'User-controlled note titles should be scrubbed so obvious script payloads are not stored as-is.'
    }
];

function normalizeBaseUrl(baseUrl = '') {
    const value = String(baseUrl || '').trim();
    return value ? value.replace(/\/+$/, '') : 'http://localhost:3000';
}

function readUtf8Files(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    return fs.readdirSync(directoryPath)
        .filter((name) => name.endsWith('.ejs') || name.endsWith('.js'))
        .map((name) => ({
            name,
            content: fs.readFileSync(path.join(directoryPath, name), 'utf8')
        }));
}

function auditPageTemplates(rootDir = process.cwd()) {
    const files = readUtf8Files(path.join(rootDir, 'src', 'views', 'pages'))
        .filter((entry) => entry.name.endsWith('.ejs'));

    const unescapedTemplateFiles = [];
    const inlineScriptFiles = [];
    const inlineEventFiles = [];
    const javascriptHrefFiles = [];

    files.forEach((file) => {
        const contentWithoutTrustedIncludes = file.content.replace(/<%-\s*include\([^)]*\)\s*%>/gu, '');

        if (/<%-/u.test(contentWithoutTrustedIncludes)) {
            unescapedTemplateFiles.push(file.name);
        }

        if (/<script(?![^>]*\bsrc=)/iu.test(file.content)) {
            inlineScriptFiles.push(file.name);
        }

        if (/\son[a-z]+\s*=/iu.test(file.content)) {
            inlineEventFiles.push(file.name);
        }

        if (/href\s*=\s*["']javascript:/iu.test(file.content)) {
            javascriptHrefFiles.push(file.name);
        }
    });

    return {
        pageTemplateCount: files.length,
        unescapedTemplateFiles,
        inlineScriptFiles,
        inlineEventFiles,
        javascriptHrefFiles,
        escapedInterpolationOnly: unescapedTemplateFiles.length === 0,
        inlineScriptTemplateCount: inlineScriptFiles.length,
        inlineEventTemplateCount: inlineEventFiles.length
    };
}

function auditClientRendering(rootDir = process.cwd()) {
    const files = readUtf8Files(path.join(rootDir, 'src', 'views', 'public', 'js'))
        .filter((entry) => entry.name.endsWith('.js'));

    const innerHtmlSinkFiles = [];
    const protectedSinkFiles = [];
    const unescapedSinkFiles = [];
    const inlineStyleTemplateFiles = [];

    files.forEach((file) => {
        if (file.content.includes('innerHTML')) {
            innerHtmlSinkFiles.push(file.name);
            if (file.content.includes('escapeHtml(') || file.content.includes('BrowserResearchModuleShared')) {
                protectedSinkFiles.push(file.name);
            } else {
                unescapedSinkFiles.push(file.name);
            }
        }

        if (file.content.includes('style="')) {
            inlineStyleTemplateFiles.push(file.name);
        }
    });

    return {
        scriptFileCount: files.length,
        innerHtmlSinkFiles,
        protectedSinkFiles,
        unescapedSinkFiles,
        escapedSinkCoverage: innerHtmlSinkFiles.length === protectedSinkFiles.length,
        inlineStyleTemplateFiles
    };
}

function listXssScenarios() {
    return SAMPLE_SCENARIOS.map((scenario) => ({ ...scenario }));
}

function getXssScenario(scenarioId = '') {
    return listXssScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

function extractDangerSignals(payload = '') {
    const value = String(payload || '');
    const signals = [];

    if (/<script\b/iu.test(value)) {
        signals.push({
            id: 'script-tag',
            label: 'Script tag detected',
            description: 'The payload contains a script tag that would execute if rendered unsafely.',
            cspMitigation: 'Blocked by escaped rendering and script-src self.'
        });
    }

    if (/\son[a-z]+\s*=/iu.test(value)) {
        signals.push({
            id: 'inline-event-handler',
            label: 'Inline event handler detected',
            description: 'The payload contains an inline event handler such as onerror or onclick.',
            cspMitigation: 'Blocked by escaped rendering and script-src-attr none.'
        });
    }

    if (/javascript:/iu.test(value)) {
        signals.push({
            id: 'javascript-url',
            label: 'javascript: URL detected',
            description: 'The payload contains a javascript: URL that should never be trusted as navigation content.',
            cspMitigation: 'Blocked by escaped rendering and script-src self.'
        });
    }

    if (/<iframe\b/iu.test(value)) {
        signals.push({
            id: 'iframe-embed',
            label: 'Iframe embed detected',
            description: 'The payload attempts to inject an iframe that should not be trusted.',
            cspMitigation: 'Blocked by escaped rendering and frame-src none.'
        });
    }

    return signals;
}

function evaluateXssScenario({ scenarioId, payload } = {}) {
    const scenario = getXssScenario(scenarioId) || null;
    const value = typeof payload === 'string' ? payload : (scenario ? scenario.payload : '');
    const dangerSignals = extractDangerSignals(value);
    const escapedPreview = escapeHtmlForRendering(value);
    const sanitizedPreview = sanitizeString(value);

    return {
        scenario: scenario || {
            id: 'custom-xss-scenario',
            label: 'Custom XSS Scenario',
            summary: 'A custom payload evaluation built from the supplied untrusted content.'
        },
        payload: value,
        dangerSignals,
        escapedPreview,
        sanitizedPreview,
        cspOutcome: {
            scriptExecutionBlocked: dangerSignals.length > 0,
            summary: dangerSignals.length
                ? 'Even if a rendering bug were introduced, the CSP still limits script execution to self-hosted files and blocks inline handlers.'
                : 'No active XSS signal was detected, but the CSP still constrains the browser runtime.'
        },
        decision: dangerSignals.length ? 'escape-and-restrict' : 'render-safe',
        summary: dangerSignals.length
            ? 'Treat this content as untrusted: encode it on output, keep templates escaped, and rely on CSP as a backstop.'
            : 'This content is plain text and renders safely through escaped templates.'
    };
}

function buildXssDefenseModuleOverview({ baseUrl } = {}) {
    const directives = buildContentSecurityPolicyDirectives();
    const templateAudit = auditPageTemplates();
    const clientAudit = auditClientRendering();
    const scenarios = listXssScenarios();
    const defaultScenario = scenarios[0];

    return {
        module: {
            name: 'XSS Defense Module',
            focus: 'Escaped rendering, sink discipline, and strict Content Security Policy',
            route: '/xss-defense/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        rendering: {
            serverTemplates: templateAudit,
            clientRendering: clientAudit,
            noteSanitization: {
                active: true,
                strategy: 'sanitizeString for note titles plus escaped rendering in EJS and browser modules.',
                fields: ['title']
            }
        },
        csp: {
            headerName: 'Content-Security-Policy',
            enforced: true,
            directives,
            directiveList: summarizeDirectiveList(directives)
        },
        controls: CONTROL_GUIDANCE.map((control) => ({ ...control })),
        scenarios,
        defaultScenarioId: defaultScenario.id,
        defaultEvaluation: evaluateXssScenario({
            scenarioId: defaultScenario.id
        })
    };
}

module.exports = {
    auditClientRendering,
    auditPageTemplates,
    buildXssDefenseModuleOverview,
    evaluateXssScenario,
    extractDangerSignals,
    getXssScenario,
    listXssScenarios
};
