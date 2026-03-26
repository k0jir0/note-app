const {
    ALLOWED_FEEDBACK_LABELS,
    appendLocatorRepairHistoryEntry,
    loadLocatorRepairHistory,
    resolveLocatorRepairHistoryPath,
    summarizeLocatorRepairHistory
} = require('../utils/locatorRepairHistoryStore');
const {
    clearLocatorRepairModelCache,
    loadLocatorRepairModel,
    predictLocatorRepairCandidate,
    resolveLocatorRepairModelPath,
    saveLocatorRepairModel,
    trainLocatorRepairModel
} = require('../utils/locatorRepairModel');

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SAMPLE_ID = 'workspace-ml-link-text-drift';
const DEFAULT_CONFIDENCE = 'low';
const DEFAULT_ENGINE_MODE = 'ML-assisted self-healing with deterministic verification';
const DEFAULT_ENGINE_NOTE = 'A trained logistic reranker now combines deterministic signals with repair feedback, but every self-heal still requires deterministic verification before continuing.';
const AUTO_HEAL_STRATEGIES = new Set(['data-testid', 'id', 'href', 'name', 'role-and-name', 'placeholder']);

const SUPPORTED_LOCATOR_FAMILIES = [
    'playwright-testid',
    'playwright-role',
    'playwright-placeholder',
    'playwright-text',
    'playwright-css',
    'selenium-id',
    'selenium-name',
    'selenium-link-text',
    'selenium-css'
];

const CONTROL_DEFINITIONS = [
    {
        id: 'locator-repair-sample-select',
        label: 'Sample selector',
        description: 'Chooses an app-shaped failure case to load into the analyzer form.',
        interaction: 'Use it to compare link-text drift, button-label drift, and form-field drift patterns.'
    },
    {
        id: 'locator-repair-load-sample-btn',
        label: 'Load Sample',
        description: 'Copies the selected sample case into the original locator, goal, and HTML snippet fields.',
        interaction: 'Use it when you want a concrete failure case before trying your own snippet.'
    },
    {
        id: 'locator-repair-analyze-btn',
        label: 'Suggest Repairs',
        description: 'Runs the deterministic candidate generator plus the trained reranker against the current locator and HTML snippet.',
        interaction: 'Use it after pasting the failing locator, the step goal, and the current DOM fragment.'
    },
    {
        id: 'locator-repair-train-btn',
        label: 'Train Model',
        description: 'Retrains the self-healing model from bootstrap samples plus accepted and rejected repair history.',
        interaction: 'Use it after collecting feedback or when you want to refresh the persisted self-heal artifact.'
    },
    {
        id: 'locator-repair-refresh-history-btn',
        label: 'Refresh History',
        description: 'Reloads the latest feedback summary and recent repair outcomes.',
        interaction: 'Use it after recording accepted, rejected, or healed suggestions.'
    },
    {
        id: 'locator-repair-html-snippet',
        label: 'HTML snippet input',
        description: 'Accepts the current DOM fragment around the intended element.',
        interaction: 'Paste the narrowest useful snippet so the ranking logic can focus on realistic candidates.'
    }
];

const WORKFLOW = [
    {
        label: 'Capture the failure',
        description: 'Start with the exact broken locator string from Playwright or Selenium plus the step intent.'
    },
    {
        label: 'Paste the current DOM',
        description: 'Provide a focused HTML snippet around the intended element instead of the whole page.'
    },
    {
        label: 'Generate deterministic candidates',
        description: 'The engine extracts interactive candidates and scores stable signals such as data-testid, id, href, name, role, and placeholder attributes.'
    },
    {
        label: 'Rerank with the trained model',
        description: 'A logistic reranker uses those signals plus repair history to estimate which candidate is most likely to heal the broken step.'
    },
    {
        label: 'Verify before continuing',
        description: 'Self-healing is only considered safe after the new locator passes a deterministic runtime check for the intended step.'
    }
];

const REPAIR_LADDER = [
    {
        label: 'Prefer data-testid when available',
        description: 'A dedicated test id is usually the most stable repair because it decouples tests from visible copy and layout shifts.'
    },
    {
        label: 'Fall back to id or name',
        description: 'Stable form control identifiers are usually safer than text locators, especially when UI copy is edited frequently.'
    },
    {
        label: 'Use role plus accessible name for user-facing controls',
        description: 'Buttons and links can still be resilient when role and label stay aligned with the product experience.'
    },
    {
        label: 'Treat href and placeholder as purpose-specific signals',
        description: 'Inputs and navigation links often expose stable attributes that survive cosmetic changes better than surrounding DOM structure.'
    },
    {
        label: 'Allow self-heal only behind verification',
        description: 'Even a strong ML-ranked repair still needs a deterministic follow-up check before it should be trusted at runtime.'
    }
];

const SUPPORTED_SIGNALS = [
    {
        label: 'data-testid',
        description: 'Highest-stability signal when the app exposes one.'
    },
    {
        label: 'id',
        description: 'Strong signal for form fields and module controls when the id is product-owned instead of generated.'
    },
    {
        label: 'name',
        description: 'Useful for form inputs when ids change but field semantics stay the same.'
    },
    {
        label: 'href',
        description: 'Strong signal for navigation links such as Research Workspace module entry points.'
    },
    {
        label: 'role and accessible name',
        description: 'Helps keep repairs aligned with accessible UI semantics.'
    },
    {
        label: 'visible text',
        description: 'Useful for intent matching, but treated as weaker than dedicated automation attributes.'
    },
    {
        label: 'step-goal token overlap',
        description: 'Words from the failing step help the reranker distinguish between similar candidates.'
    },
    {
        label: 'accepted and rejected repair history',
        description: 'The trained model learns from accepted, rejected, and healed repair outcomes over time.'
    }
];

const SAMPLE_CASES = [
    {
        id: 'workspace-ml-link-text-drift',
        title: 'Research link text drift',
        summary: 'A Selenium linkText locator broke after the ML card button text changed but the route and test id stayed stable.',
        originalLocator: 'By.linkText("Open ML Module")',
        stepGoal: 'Open the ML Module from the Research Workspace',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <a href="/security/module" class="btn btn-outline-dark" data-testid="research-open-security">Open Security Module</a>',
            '    <a href="/ml/module" class="btn btn-outline-dark" data-testid="research-open-ml">Open ML Workspace</a>',
            '    <a href="/playwright/module" class="btn btn-outline-dark" data-testid="research-open-playwright">Open Playwright Module</a>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'research-open-ml',
            href: '/ml/module'
        }
    },
    {
        id: 'playwright-load-spec-label-drift',
        title: 'Playwright button copy drift',
        summary: 'A role-and-name locator broke after the visible button label changed but a stable id and test id were added.',
        originalLocator: 'page.getByRole("button", { name: "Load Spec" })',
        stepGoal: 'Reload the generated Playwright spec preview',
        htmlSnippet: [
            '<div class="btn-toolbar gap-2">',
            '    <button type="button" id="playwright-refresh-btn" class="btn btn-outline-dark">Refresh Module</button>',
            '    <button type="button" id="playwright-load-script-btn" data-testid="playwright-load-spec" class="btn btn-outline-dark">Load Starter Spec</button>',
            '    <button type="button" id="playwright-copy-script-btn" class="btn btn-secondary">Copy Spec</button>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'playwright-load-spec',
            id: 'playwright-load-script-btn'
        }
    },
    {
        id: 'login-email-id-drift',
        title: 'Login field id drift',
        summary: 'A CSS id locator broke after the login field id changed but semantic attributes still identify the email input.',
        originalLocator: 'page.locator("#email")',
        stepGoal: 'Fill the login email field before submitting the form',
        htmlSnippet: [
            '<form action="/auth/login">',
            '    <label for="login-email-input">Email</label>',
            '    <input id="login-email-input" name="email" type="email" placeholder="Email address" data-testid="auth-email-input" />',
            '    <label for="login-password-input">Password</label>',
            '    <input id="login-password-input" name="password" type="password" placeholder="Password" data-testid="auth-password-input" />',
            '</form>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'auth-email-input',
            name: 'email'
        }
    },
    {
        id: 'workspace-selenium-link-drift',
        title: 'Selenium workspace link drift',
        summary: 'A text-driven workspace link broke after the Selenium card text changed but the href and test id stayed stable.',
        originalLocator: 'By.linkText("Open Selenium Module")',
        stepGoal: 'Open the Selenium Module from the Research Workspace',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <a href="/ml/module" class="btn btn-outline-dark" data-testid="research-open-ml">Open ML Module</a>',
            '    <a href="/selenium/module" class="btn btn-outline-dark" data-testid="research-open-selenium">Open Selenium Workspace</a>',
            '    <a href="/playwright/module" class="btn btn-outline-dark" data-testid="research-open-playwright">Open Playwright Module</a>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'research-open-selenium',
            href: '/selenium/module'
        }
    },
    {
        id: 'locator-analyze-button-drift',
        title: 'Self-healing analyze button drift',
        summary: 'The analysis button label changed but the id and test id remained stable.',
        originalLocator: 'page.getByRole("button", { name: "Analyze Locator" })',
        stepGoal: 'Analyze the self-healing request',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <button type="button" id="locator-repair-load-sample-btn" class="btn btn-outline-dark">Load Sample</button>',
            '    <button type="button" id="locator-repair-analyze-btn" data-testid="locator-repair-suggest" class="btn btn-dark">Suggest Repairs</button>',
            '    <button type="button" id="locator-repair-train-btn" class="btn btn-outline-primary">Train Model</button>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'locator-repair-suggest',
            id: 'locator-repair-analyze-btn'
        }
    }
];

const TOKEN_STOPWORDS = new Set([
    'a',
    'an',
    'and',
    'before',
    'button',
    'click',
    'field',
    'for',
    'from',
    'the',
    'this',
    'to',
    'with'
]);

let cachedBootstrapModel = null;

function normalizeBaseUrl(baseUrl) {
    const normalized = typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim()
        : DEFAULT_BASE_URL;

    return normalized.replace(/\/+$/, '');
}

function normalizeComparable(value = '') {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function decodeEntities(value = '') {
    return String(value)
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', '\'');
}

function stripTags(value = '') {
    return decodeEntities(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tokenize(value = '') {
    return Array.from(new Set(
        String(value)
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .map((token) => token.trim())
            .filter((token) => token && !TOKEN_STOPWORDS.has(token))
    ));
}

function parseAttributes(attributeSource = '') {
    const attributes = {};
    const attributePattern = /([:@\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match = attributePattern.exec(attributeSource);

    while (match) {
        const name = match[1];
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        attributes[name] = decodeEntities(value);
        match = attributePattern.exec(attributeSource);
    }

    return attributes;
}

function deriveRole(tag, attributes = {}) {
    if (attributes.role) {
        return String(attributes.role).trim().toLowerCase();
    }

    if (tag === 'a' && attributes.href) {
        return 'link';
    }

    if (tag === 'button') {
        return 'button';
    }

    if (tag === 'input') {
        const type = String(attributes.type || 'text').trim().toLowerCase();
        if (['button', 'submit', 'reset'].includes(type)) {
            return 'button';
        }

        return 'textbox';
    }

    if (tag === 'textarea') {
        return 'textbox';
    }

    if (tag === 'select') {
        return 'combobox';
    }

    if (tag === 'option') {
        return 'option';
    }

    return '';
}

function buildCandidateSearchTokens(candidate) {
    return Array.from(new Set([
        ...tokenize(candidate.tag),
        ...tokenize(candidate.role),
        ...tokenize(candidate.text),
        ...tokenize(candidate.accessibleName),
        ...tokenize(candidate.id),
        ...tokenize(candidate.dataTestId),
        ...tokenize(candidate.href),
        ...tokenize(candidate.name),
        ...tokenize(candidate.placeholder),
        ...tokenize(candidate.ariaLabel)
    ]));
}

function extractInteractiveElements(htmlSnippet = '') {
    const source = String(htmlSnippet || '');
    if (!source.trim()) {
        return [];
    }

    const candidates = [];
    const seen = new Set();
    const pairedPattern = /<(a|button|label|option|textarea)([^>]*)>([\s\S]*?)<\/\1>/gi;
    const utilityContainerPattern = /<(div|span)([^>]*)>([\s\S]*?)<\/\1>/gi;
    const voidPattern = /<(input|select)([^>]*)>/gi;

    function maybePushCandidate(tag, attributes, innerText = '') {
        const role = deriveRole(tag, attributes);
        const interactiveByTag = ['a', 'button', 'input', 'select', 'textarea', 'option', 'label'].includes(tag);
        const usefulDivOrSpan = Boolean(role || attributes['data-testid'] || attributes.id);

        if (!interactiveByTag && !usefulDivOrSpan) {
            return;
        }

        const text = stripTags(innerText);
        const accessibleName = attributes['aria-label'] || text || attributes.placeholder || attributes.value || attributes.name || attributes.id || '';
        const candidate = {
            tag,
            role,
            text,
            accessibleName,
            id: attributes.id || '',
            dataTestId: attributes['data-testid'] || attributes['data-test-id'] || '',
            href: attributes.href || '',
            name: attributes.name || '',
            placeholder: attributes.placeholder || '',
            ariaLabel: attributes['aria-label'] || '',
            type: attributes.type || '',
            attributes
        };
        candidate.tokens = buildCandidateSearchTokens(candidate);

        const dedupeKey = JSON.stringify({
            tag: candidate.tag,
            role: candidate.role,
            text: candidate.text,
            id: candidate.id,
            dataTestId: candidate.dataTestId,
            href: candidate.href,
            name: candidate.name,
            placeholder: candidate.placeholder
        });

        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            candidates.push(candidate);
        }
    }

    let match = pairedPattern.exec(source);
    while (match) {
        const tag = String(match[1] || '').toLowerCase();
        const attributes = parseAttributes(match[2] || '');
        maybePushCandidate(tag, attributes, match[3] || '');
        match = pairedPattern.exec(source);
    }

    match = utilityContainerPattern.exec(source);
    while (match) {
        const tag = String(match[1] || '').toLowerCase();
        const attributes = parseAttributes(match[2] || '');
        maybePushCandidate(tag, attributes, match[3] || '');
        match = utilityContainerPattern.exec(source);
    }

    match = voidPattern.exec(source);
    while (match) {
        const tag = String(match[1] || '').toLowerCase();
        const attributes = parseAttributes(match[2] || '');
        maybePushCandidate(tag, attributes, '');
        match = voidPattern.exec(source);
    }

    return candidates;
}

function parseCssSelector(cssSelector = '') {
    const parsed = {};
    const selector = String(cssSelector || '').trim();
    const tagMatch = selector.match(/^([a-z]+)\b/i);
    const idMatch = selector.match(/#([\w-]+)/);
    const dataTestIdMatch = selector.match(/\[data-testid=['"]?([^'"\]]+)['"]?\]/i);
    const hrefMatch = selector.match(/\[href=['"]([^'"]+)['"]\]/i);
    const nameMatch = selector.match(/\[name=['"]([^'"]+)['"]\]/i);
    const placeholderMatch = selector.match(/\[placeholder=['"]([^'"]+)['"]\]/i);
    const classMatches = Array.from(selector.matchAll(/\.([\w-]+)/g)).map((entry) => entry[1]);

    if (tagMatch) {
        parsed.tag = String(tagMatch[1]).toLowerCase();
    }

    if (idMatch) {
        parsed.id = idMatch[1];
    }

    if (dataTestIdMatch) {
        parsed.dataTestId = dataTestIdMatch[1];
    }

    if (hrefMatch) {
        parsed.href = hrefMatch[1];
    }

    if (nameMatch) {
        parsed.name = nameMatch[1];
    }

    if (placeholderMatch) {
        parsed.placeholder = placeholderMatch[1];
    }

    if (!parsed.id && classMatches.length > 0 && !parsed.dataTestId && !parsed.href && !parsed.name && !parsed.placeholder) {
        parsed.classOnly = true;
    }

    return parsed;
}

function parseLocatorSignals(locator = '') {
    const rawLocator = String(locator || '').trim();
    const signals = {
        raw: rawLocator,
        family: 'unknown',
        role: '',
        tag: '',
        text: '',
        id: '',
        dataTestId: '',
        href: '',
        name: '',
        placeholder: '',
        warnings: []
    };

    if (!rawLocator) {
        signals.warnings.push('No original locator was provided.');
        return signals;
    }

    let match = rawLocator.match(/getByTestId\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'playwright-testid';
        signals.dataTestId = match[2];
    }

    match = rawLocator.match(/getByRole\((['"])(.*?)\1(?:\s*,\s*\{[^}]*name:\s*(['"])(.*?)\3[^}]*\})?/i);
    if (match) {
        signals.family = 'playwright-role';
        signals.role = String(match[2] || '').trim().toLowerCase();
        signals.text = match[4] || '';
    }

    match = rawLocator.match(/getByPlaceholder\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'playwright-placeholder';
        signals.placeholder = match[2];
    }

    match = rawLocator.match(/getByText\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'playwright-text';
        signals.text = match[2];
    }

    match = rawLocator.match(/page\.locator\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'playwright-css';
        Object.assign(signals, parseCssSelector(match[2]));
    }

    match = rawLocator.match(/By\.id\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'selenium-id';
        signals.id = match[2];
    }

    match = rawLocator.match(/By\.name\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'selenium-name';
        signals.name = match[2];
    }

    match = rawLocator.match(/By\.linkText\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'selenium-link-text';
        signals.role = 'link';
        signals.text = match[2];
    }

    match = rawLocator.match(/By\.css\((['"])(.*?)\1\)/i);
    if (match) {
        signals.family = 'selenium-css';
        Object.assign(signals, parseCssSelector(match[2]));
    }

    if (/:nth-(child|of-type)\(/i.test(rawLocator)) {
        signals.warnings.push('The original locator depends on nth-child style indexing, which is usually brittle when layout changes.');
    }

    if (signals.family === 'selenium-link-text' || signals.family === 'playwright-text') {
        signals.warnings.push('The original locator depends on visible text, which is brittle when copy changes.');
    }

    if (signals.family === 'playwright-role' && signals.text) {
        signals.warnings.push('Role-based locators are readable, but their visible name can still drift when labels are rewritten.');
    }

    if (signals.classOnly) {
        signals.warnings.push('The original CSS locator appears to rely on classes only, which often drift during styling changes.');
    }

    signals.tokens = Array.from(new Set([
        ...tokenize(signals.text),
        ...tokenize(signals.id),
        ...tokenize(signals.dataTestId),
        ...tokenize(signals.href),
        ...tokenize(signals.name),
        ...tokenize(signals.placeholder),
        ...tokenize(signals.role)
    ]));

    return signals;
}

function countTokenOverlap(left = [], right = []) {
    if (!left.length || !right.length) {
        return 0;
    }

    const rightSet = new Set(right);
    return left.filter((token) => rightSet.has(token)).length;
}

function addReason(reasons, message) {
    if (!reasons.includes(message)) {
        reasons.push(message);
    }
}

function isTextDrivenLocator(signals = {}) {
    return ['selenium-link-text', 'playwright-text'].includes(signals.family)
        || (signals.family === 'playwright-role' && Boolean(signals.text));
}

function countStableSignals(candidate = {}) {
    return [
        candidate.dataTestId,
        candidate.id,
        candidate.href,
        candidate.name,
        candidate.placeholder
    ].filter((value) => Boolean(String(value || '').trim())).length;
}

function scoreCandidate(candidate, originalSignals, stepTokens) {
    const reasons = [];
    let score = 0;

    if (originalSignals.dataTestId && candidate.dataTestId === originalSignals.dataTestId) {
        score += 150;
        addReason(reasons, `Matched the original data-testid "${originalSignals.dataTestId}".`);
    }

    if (originalSignals.id && candidate.id === originalSignals.id) {
        score += 130;
        addReason(reasons, `Matched the original id "${originalSignals.id}".`);
    }

    if (originalSignals.href && candidate.href === originalSignals.href) {
        score += 120;
        addReason(reasons, `Matched the original href "${originalSignals.href}".`);
    }

    if (originalSignals.name && candidate.name === originalSignals.name) {
        score += 100;
        addReason(reasons, `Matched the original name "${originalSignals.name}".`);
    }

    if (originalSignals.placeholder && candidate.placeholder === originalSignals.placeholder) {
        score += 90;
        addReason(reasons, `Matched the original placeholder "${originalSignals.placeholder}".`);
    }

    const originalText = normalizeComparable(originalSignals.text);
    const candidateText = normalizeComparable(candidate.text);
    if (originalText && candidateText && originalText === candidateText) {
        score += 85;
        addReason(reasons, 'Matched the original visible text exactly.');
    }

    if (originalSignals.role && candidate.role && originalSignals.role === candidate.role) {
        score += 25;
        addReason(reasons, `Matched the original role "${originalSignals.role}".`);
    }

    if (originalSignals.tag && candidate.tag && originalSignals.tag === candidate.tag) {
        score += 15;
    }

    const originalTokens = Array.isArray(originalSignals.tokens) ? originalSignals.tokens : [];
    const candidateTokens = Array.isArray(candidate.tokens) ? candidate.tokens : [];
    const originalOverlap = countTokenOverlap(originalTokens, candidateTokens);
    const stepOverlap = countTokenOverlap(stepTokens, candidateTokens);

    if (originalOverlap > 0) {
        score += Math.min(50, originalOverlap * 12);
        addReason(reasons, `Shared ${originalOverlap} token(s) with the original locator intent.`);
    }

    if (stepOverlap > 0) {
        score += Math.min(45, stepOverlap * 9);
        addReason(reasons, `Shared ${stepOverlap} token(s) with the step goal.`);
    }

    if (candidate.dataTestId) {
        score += 35;
        addReason(reasons, `Candidate exposes stable data-testid "${candidate.dataTestId}".`);
    }

    if (candidate.id) {
        score += 30;
        addReason(reasons, `Candidate exposes stable id "${candidate.id}".`);
    }

    if (candidate.href && candidate.role === 'link') {
        score += 25;
        addReason(reasons, `Candidate exposes stable href "${candidate.href}".`);
    }

    if (candidate.name) {
        score += 20;
        addReason(reasons, `Candidate exposes semantic name "${candidate.name}".`);
    }

    if (candidate.role && candidate.accessibleName) {
        score += 12;
    }

    if (isTextDrivenLocator(originalSignals) && candidate.dataTestId) {
        score += 18;
        addReason(reasons, 'Upgrades the repair from a text-driven locator to a dedicated automation attribute.');
    }

    if (isTextDrivenLocator(originalSignals) && (candidate.id || candidate.name) && !candidate.dataTestId) {
        score += 10;
        addReason(reasons, 'Upgrades the repair from a text-driven locator to an id-or-name based strategy.');
    }

    if (!candidate.dataTestId && !candidate.id && !candidate.href && !candidate.name && !candidate.placeholder && !candidate.text) {
        score -= 20;
    }

    return {
        score,
        reasons,
        originalOverlap,
        stepOverlap,
        stableSignalCount: countStableSignals(candidate)
    };
}

function quoteJs(value) {
    return JSON.stringify(String(value));
}

function buildAttributeSelector(attributeName, value) {
    return `[${attributeName}=${quoteJs(value)}]`;
}

function escapeXpathLiteral(value = '') {
    const stringValue = String(value);

    if (!stringValue.includes('\'')) {
        return `'${stringValue}'`;
    }

    if (!stringValue.includes('"')) {
        return `"${stringValue}"`;
    }

    return `concat(${stringValue.split('\'').map((segment) => `'${segment}'`).join(', "\'", ')})`;
}

function buildLocatorAlternatives(candidate) {
    const alternatives = [];
    const seen = new Set();

    function pushAlternative(strategy, stability, playwrightLocator, seleniumLocator) {
        const dedupeKey = `${playwrightLocator}::${seleniumLocator}`;
        if (seen.has(dedupeKey)) {
            return;
        }

        seen.add(dedupeKey);
        alternatives.push({
            strategy,
            stability,
            playwright: playwrightLocator,
            selenium: seleniumLocator
        });
    }

    if (candidate.dataTestId) {
        pushAlternative(
            'data-testid',
            'highest',
            `page.getByTestId(${quoteJs(candidate.dataTestId)})`,
            `By.css(${quoteJs(buildAttributeSelector('data-testid', candidate.dataTestId))})`
        );
    }

    if (candidate.id) {
        pushAlternative(
            'id',
            'high',
            `page.locator(${quoteJs(buildAttributeSelector('id', candidate.id))})`,
            `By.id(${quoteJs(candidate.id)})`
        );
    }

    if (candidate.role && candidate.accessibleName) {
        const accessibleName = candidate.accessibleName.trim();
        const playwrightLocator = `page.getByRole(${quoteJs(candidate.role)}, { name: ${quoteJs(accessibleName)} })`;
        const seleniumLocator = candidate.role === 'link'
            ? `By.linkText(${quoteJs(accessibleName)})`
            : `By.xpath(${quoteJs(`//${candidate.tag}[normalize-space()=${escapeXpathLiteral(accessibleName)}]`)})`;

        pushAlternative('role-and-name', 'medium', playwrightLocator, seleniumLocator);
    }

    if (candidate.href && candidate.tag === 'a') {
        const selector = `a[href="${candidate.href}"]`;
        pushAlternative(
            'href',
            'high',
            `page.locator(${quoteJs(selector)})`,
            `By.css(${quoteJs(selector)})`
        );
    }

    if (candidate.name) {
        pushAlternative(
            'name',
            'medium',
            `page.locator(${quoteJs(buildAttributeSelector('name', candidate.name))})`,
            `By.name(${quoteJs(candidate.name)})`
        );
    }

    if (candidate.placeholder) {
        pushAlternative(
            'placeholder',
            'medium',
            `page.getByPlaceholder(${quoteJs(candidate.placeholder)})`,
            `By.css(${quoteJs(buildAttributeSelector('placeholder', candidate.placeholder))})`
        );
    }

    if (candidate.text) {
        const textValue = candidate.text.trim();
        const seleniumLocator = candidate.role === 'link'
            ? `By.linkText(${quoteJs(textValue)})`
            : `By.xpath(${quoteJs(`//*[normalize-space()=${escapeXpathLiteral(textValue)}]`)})`;

        pushAlternative(
            'text',
            'low',
            `page.getByText(${quoteJs(textValue)}, { exact: true })`,
            seleniumLocator
        );
    }

    return alternatives;
}

function normalizeHeuristicScore(score) {
    const normalized = (Number(score) + 20) / 220;
    return Math.max(0, Math.min(normalized, 1));
}

function classifyConfidence(score) {
    if (score >= 0.82) {
        return 'high';
    }

    if (score >= 0.62) {
        return 'medium';
    }

    return DEFAULT_CONFIDENCE;
}

function buildDetectedSignals(signals = {}) {
    const entries = [
        ['Locator family', signals.family],
        ['Role', signals.role],
        ['Tag', signals.tag],
        ['Visible text', signals.text],
        ['id', signals.id],
        ['data-testid', signals.dataTestId],
        ['href', signals.href],
        ['name', signals.name],
        ['placeholder', signals.placeholder]
    ];

    return entries
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([label, value]) => ({ label, value }));
}

function buildCandidateFingerprint(candidate = {}) {
    return JSON.stringify({
        tag: candidate.tag || '',
        role: candidate.role || '',
        text: normalizeComparable(candidate.text),
        accessibleName: normalizeComparable(candidate.accessibleName),
        id: candidate.id || '',
        dataTestId: candidate.dataTestId || '',
        href: candidate.href || '',
        name: candidate.name || '',
        placeholder: candidate.placeholder || ''
    });
}

function buildCandidateSummary(candidate) {
    return {
        fingerprint: buildCandidateFingerprint(candidate),
        tag: candidate.tag,
        role: candidate.role || 'none',
        text: candidate.text || '',
        accessibleName: candidate.accessibleName || '',
        id: candidate.id || '',
        dataTestId: candidate.dataTestId || '',
        href: candidate.href || '',
        name: candidate.name || '',
        placeholder: candidate.placeholder || ''
    };
}

function buildLearningFeatures({ candidate, originalSignals, scored }) {
    const originalFamily = String(originalSignals.family || '');
    const normalizedText = normalizeComparable(originalSignals.text);
    const normalizedCandidateText = normalizeComparable(candidate.text);

    return {
        heuristicScoreNorm: normalizeHeuristicScore(scored.score),
        candidateHasDataTestId: Boolean(candidate.dataTestId),
        candidateHasId: Boolean(candidate.id),
        candidateHasHref: Boolean(candidate.href),
        candidateHasName: Boolean(candidate.name),
        candidateHasPlaceholder: Boolean(candidate.placeholder),
        candidateHasAccessibleName: Boolean(candidate.accessibleName),
        candidateHasText: Boolean(candidate.text),
        candidateRoleLink: candidate.role === 'link',
        candidateRoleButton: candidate.role === 'button',
        candidateRoleTextbox: candidate.role === 'textbox',
        originalFamilyText: ['selenium-link-text', 'playwright-text'].includes(originalFamily),
        originalFamilyRole: originalFamily === 'playwright-role',
        originalFamilyCss: ['playwright-css', 'selenium-css'].includes(originalFamily),
        originalFamilyId: originalFamily === 'selenium-id',
        originalFamilyName: originalFamily === 'selenium-name',
        originalFamilyPlaceholder: originalFamily === 'playwright-placeholder',
        exactDataTestIdMatch: Boolean(originalSignals.dataTestId && candidate.dataTestId === originalSignals.dataTestId),
        exactIdMatch: Boolean(originalSignals.id && candidate.id === originalSignals.id),
        exactHrefMatch: Boolean(originalSignals.href && candidate.href === originalSignals.href),
        exactNameMatch: Boolean(originalSignals.name && candidate.name === originalSignals.name),
        exactPlaceholderMatch: Boolean(originalSignals.placeholder && candidate.placeholder === originalSignals.placeholder),
        exactTextMatch: Boolean(normalizedText && normalizedCandidateText && normalizedText === normalizedCandidateText),
        roleMatch: Boolean(originalSignals.role && candidate.role && originalSignals.role === candidate.role),
        tagMatch: Boolean(originalSignals.tag && candidate.tag && originalSignals.tag === candidate.tag),
        originalOverlap: scored.originalOverlap,
        stepOverlap: scored.stepOverlap,
        stableSignalCount: scored.stableSignalCount,
        upgradeTextToDataTestId: isTextDrivenLocator(originalSignals) && Boolean(candidate.dataTestId),
        upgradeTextToIdOrName: isTextDrivenLocator(originalSignals) && Boolean(candidate.id || candidate.name),
        candidateTextLength: String(candidate.accessibleName || candidate.text || '').trim().length
    };
}

function buildModelSummary(model, options = {}) {
    if (!model) {
        return {
            available: false,
            source: 'none',
            path: resolveLocatorRepairModelPath(options.modelPath),
            modelType: 'logistic-regression',
            scoreSource: 'heuristic-only',
            trainedAt: null,
            trainingSamples: 0,
            positiveSamples: 0,
            negativeSamples: 0,
            metrics: {}
        };
    }

    return {
        available: true,
        source: options.source || 'persisted',
        path: options.source === 'persisted'
            ? resolveLocatorRepairModelPath(options.modelPath)
            : 'in-memory bootstrap',
        modelType: model.modelType || 'logistic-regression',
        scoreSource: model.scoreSource || 'trained-locator-repair-logistic-regression',
        trainedAt: model.trainedAt || null,
        trainingSamples: Number(model.trainingSamples) || 0,
        positiveSamples: Number(model.positiveSamples) || 0,
        negativeSamples: Number(model.negativeSamples) || 0,
        metrics: model.metrics && typeof model.metrics === 'object'
            ? model.metrics
            : {}
    };
}

function candidateMatchesExpected(candidate, expected = {}) {
    const entries = Object.entries(expected);
    if (entries.length === 0) {
        return false;
    }

    return entries.every(([key, value]) => normalizeComparable(candidate[key]) === normalizeComparable(value));
}

function buildBootstrapTrainingExamples() {
    return SAMPLE_CASES.flatMap((sample) => {
        const originalSignals = parseLocatorSignals(sample.originalLocator);
        const stepTokens = Array.from(new Set([
            ...tokenize(sample.stepGoal),
            ...originalSignals.tokens
        ]));
        const candidates = extractInteractiveElements(sample.htmlSnippet);

        return candidates.map((candidate) => {
            const scored = scoreCandidate(candidate, originalSignals, stepTokens);
            const label = candidateMatchesExpected(candidate, sample.expectedCandidate) ? 1 : 0;

            return {
                label,
                weight: label === 1 ? 2.6 : 1,
                source: `sample:${sample.id}`,
                features: buildLearningFeatures({
                    candidate,
                    originalSignals,
                    scored
                })
            };
        });
    });
}

function buildHistoryTrainingExamples(entries = []) {
    return entries.flatMap((entry) => {
        if (!entry || !entry.request || !entry.request.locator || !entry.request.htmlSnippet) {
            return [];
        }

        const originalSignals = parseLocatorSignals(entry.request.locator);
        const stepTokens = Array.from(new Set([
            ...tokenize(entry.request.stepGoal || ''),
            ...originalSignals.tokens
        ]));
        const candidates = extractInteractiveElements(entry.request.htmlSnippet);

        return candidates.flatMap((candidate) => {
            const fingerprint = buildCandidateFingerprint(candidate);
            let label = null;

            if (['accepted', 'healed'].includes(entry.feedbackLabel)) {
                label = fingerprint === entry.selectedFingerprint ? 1 : 0;
            } else if (entry.feedbackLabel === 'rejected' && fingerprint === entry.selectedFingerprint) {
                label = 0;
            }

            if (label === null) {
                return [];
            }

            const scored = scoreCandidate(candidate, originalSignals, stepTokens);
            const positiveWeight = entry.feedbackLabel === 'healed' ? 3.2 : 2.4;
            const negativeWeight = entry.feedbackLabel === 'rejected' ? 1.7 : 0.9;

            return [{
                label,
                weight: label === 1 ? positiveWeight : negativeWeight,
                source: `feedback:${entry.feedbackLabel}`,
                features: buildLearningFeatures({
                    candidate,
                    originalSignals,
                    scored
                })
            }];
        });
    });
}

function getRuntimeModelState(options = {}) {
    const persistedModel = loadLocatorRepairModel({ modelPath: options.modelPath });
    if (persistedModel) {
        return {
            model: persistedModel,
            summary: buildModelSummary(persistedModel, {
                source: 'persisted',
                modelPath: options.modelPath
            })
        };
    }

    if (!cachedBootstrapModel) {
        cachedBootstrapModel = trainLocatorRepairModel(buildBootstrapTrainingExamples(), {
            learningRate: 0.34,
            epochs: 520
        });
    }

    return {
        model: cachedBootstrapModel,
        summary: buildModelSummary(cachedBootstrapModel, {
            source: 'bootstrap',
            modelPath: options.modelPath
        })
    };
}

function buildFallbackSuggestion(originalSignals, modelSummary) {
    return {
        rank: 1,
        score: 0,
        heuristicScore: 0,
        confidence: 'low',
        candidate: {
            fingerprint: '',
            tag: '',
            role: '',
            text: '',
            accessibleName: '',
            id: '',
            dataTestId: '',
            href: '',
            name: '',
            placeholder: ''
        },
        primaryLocator: {
            strategy: 'add-data-testid',
            stability: 'highest',
            playwright: 'page.getByTestId("choose-a-stable-id")',
            selenium: 'By.css(\'[data-testid="choose-a-stable-id"]\')'
        },
        alternativeLocators: [],
        reasons: [
            'No strong interactive candidate was detected in the supplied HTML snippet.',
            'Add a dedicated data-testid to the intended element, then rerun the failing step with a deterministic assertion.'
        ],
        sourceLocatorFamily: originalSignals.family,
        ml: {
            available: modelSummary.available,
            score: 0,
            label: 'low',
            reasons: ['No candidate was available for the trained reranker to evaluate.'],
            scoreSource: modelSummary.scoreSource || 'heuristic-only'
        },
        hybrid: {
            score: 0
        },
        healDecision: {
            canVerify: false,
            stableStrategy: false,
            autoApplyEligible: false,
            margin: 0,
            reason: 'No concrete candidate was found, so self-healing is not possible yet.'
        }
    };
}

function buildSuggestionResult(candidate, originalSignals, stepTokens, modelState) {
    const scored = scoreCandidate(candidate, originalSignals, stepTokens);
    const alternatives = buildLocatorAlternatives(candidate);
    const primaryLocator = alternatives[0];
    const learningFeatures = buildLearningFeatures({
        candidate,
        originalSignals,
        scored
    });
    const mlPrediction = modelState.model
        ? predictLocatorRepairCandidate(learningFeatures, modelState.model)
        : null;
    const heuristicScoreNorm = normalizeHeuristicScore(scored.score);
    const hybridScore = mlPrediction
        ? Number(((heuristicScoreNorm * 0.42) + (mlPrediction.score * 0.58)).toFixed(3))
        : Number(heuristicScoreNorm.toFixed(3));

    return {
        score: Number((hybridScore * 100).toFixed(1)),
        heuristicScore: scored.score,
        confidence: classifyConfidence(hybridScore),
        candidate: buildCandidateSummary(candidate),
        primaryLocator,
        alternativeLocators: alternatives.slice(1),
        reasons: scored.reasons,
        sourceLocatorFamily: originalSignals.family,
        ml: {
            available: Boolean(mlPrediction),
            score: mlPrediction ? mlPrediction.score : 0,
            label: mlPrediction ? mlPrediction.label : 'low',
            reasons: mlPrediction ? mlPrediction.reasons : [],
            scoreSource: modelState.summary.scoreSource || 'heuristic-only'
        },
        hybrid: {
            score: hybridScore
        },
        learningFeatures
    };
}

function applyHealDecisions(suggestions = []) {
    return suggestions.map((suggestion, index) => {
        const nextSuggestion = suggestions[index + 1];
        const stableStrategy = AUTO_HEAL_STRATEGIES.has(suggestion.primaryLocator && suggestion.primaryLocator.strategy);
        const margin = Number((
            (suggestion.hybrid && suggestion.hybrid.score ? suggestion.hybrid.score : 0) -
            (nextSuggestion && nextSuggestion.hybrid && nextSuggestion.hybrid.score ? nextSuggestion.hybrid.score : 0)
        ).toFixed(3));
        const autoApplyEligible = Boolean(suggestion.primaryLocator)
            && stableStrategy
            && suggestion.ml
            && suggestion.ml.available
            && Number(suggestion.ml.score || 0) >= 0.62
            && Number(suggestion.hybrid && suggestion.hybrid.score || 0) >= 0.72
            && margin >= 0.08;
        const reason = autoApplyEligible
            ? 'This repair is strong enough to try at runtime, but only behind a deterministic verification step.'
            : stableStrategy
                ? 'This repair can be verified, but the confidence or separation from nearby candidates is not high enough for automatic healing.'
                : 'This repair is still reviewable, but its locator strategy is too brittle for automatic self-healing.';

        return {
            ...suggestion,
            healDecision: {
                canVerify: Boolean(suggestion.primaryLocator),
                stableStrategy,
                autoApplyEligible,
                margin,
                reason
            }
        };
    });
}

function getSampleCase(sampleId = DEFAULT_SAMPLE_ID) {
    const normalizedId = typeof sampleId === 'string' && sampleId.trim()
        ? sampleId.trim()
        : DEFAULT_SAMPLE_ID;

    return SAMPLE_CASES.find((sample) => sample.id === normalizedId) || SAMPLE_CASES[0];
}

function getSampleCaseIds() {
    return SAMPLE_CASES.map((sample) => sample.id);
}

function getLocatorRepairHistory(options = {}) {
    const history = loadLocatorRepairHistory({ historyPath: options.historyPath });
    const summary = summarizeLocatorRepairHistory(history, {
        limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8
    });

    return {
        path: resolveLocatorRepairHistoryPath(options.historyPath),
        summary,
        entries: summary.recentEntries
    };
}

function buildLocatorRepairModuleOverview({ baseUrl, modelPath, historyPath } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const modelState = getRuntimeModelState({ modelPath });
    const history = getLocatorRepairHistory({ historyPath, limit: 8 });

    return {
        module: {
            name: 'Self-Healing Module',
            runtime: DEFAULT_ENGINE_MODE,
            targetFrameworks: 'Playwright and Selenium',
            exportStyle: 'Ranked self-healing suggestions and runtime self-heal helpers',
            baseUrl: normalizedBaseUrl,
            engineNote: DEFAULT_ENGINE_NOTE
        },
        coverage: {
            sampleCaseCount: SAMPLE_CASES.length,
            supportedLocatorFamilyCount: SUPPORTED_LOCATOR_FAMILIES.length,
            outputTargetCount: 2,
            feedbackEntryCount: history.summary.totalEntries,
            verifiedHealCount: history.summary.healedCount
        },
        controls: CONTROL_DEFINITIONS.map((control) => ({ ...control })),
        workflow: WORKFLOW.map((item) => ({ ...item })),
        repairLadder: REPAIR_LADDER.map((item) => ({ ...item })),
        supportedSignals: SUPPORTED_SIGNALS.map((item) => ({ ...item })).slice(0, 8),
        sampleCases: SAMPLE_CASES.map((sample) => ({
            id: sample.id,
            title: sample.title,
            summary: sample.summary,
            originalLocator: sample.originalLocator,
            stepGoal: sample.stepGoal,
            htmlSnippet: sample.htmlSnippet
        })),
        supportedLocatorFamilies: [...SUPPORTED_LOCATOR_FAMILIES],
        defaultSampleId: DEFAULT_SAMPLE_ID,
        generatedAt: new Date().toISOString(),
        model: modelState.summary,
        history: history.summary,
        runtimeHelpers: {
            playwright: 'src/lib/playwrightSelfHealing.js',
            selenium: 'src/lib/seleniumSelfHealing.js'
        }
    };
}

function suggestLocatorRepairs({ locator, stepGoal = '', htmlSnippet = '', modelPath } = {}) {
    const originalSignals = parseLocatorSignals(locator);
    const candidates = extractInteractiveElements(htmlSnippet);
    const stepTokens = Array.from(new Set([
        ...tokenize(stepGoal),
        ...originalSignals.tokens
    ]));
    const modelState = getRuntimeModelState({ modelPath });

    const warnings = Array.from(new Set([
        ...(Array.isArray(originalSignals.warnings) ? originalSignals.warnings : [])
    ]));

    if (!String(htmlSnippet || '').trim()) {
        warnings.push('No HTML snippet was provided, so only generic repair guidance is available.');
    }

    if (!candidates.length && String(htmlSnippet || '').trim()) {
        warnings.push('No interactive elements were detected in the supplied HTML snippet.');
    }

    let suggestions = candidates
        .map((candidate) => buildSuggestionResult(candidate, originalSignals, stepTokens, modelState))
        .filter((result) => result.primaryLocator && (result.heuristicScore > 25 || Number(result.hybrid.score || 0) >= 0.45))
        .sort((left, right) => {
            const hybridDelta = Number(right.hybrid && right.hybrid.score || 0) - Number(left.hybrid && left.hybrid.score || 0);
            if (hybridDelta !== 0) {
                return hybridDelta;
            }

            return Number(right.heuristicScore || 0) - Number(left.heuristicScore || 0);
        })
        .slice(0, 5)
        .map((result, index) => ({
            ...result,
            rank: index + 1
        }));

    suggestions = suggestions.length
        ? applyHealDecisions(suggestions)
        : [buildFallbackSuggestion(originalSignals, modelState.summary)];

    return {
        engine: {
            mode: DEFAULT_ENGINE_MODE,
            note: DEFAULT_ENGINE_NOTE,
            deterministicVerificationRequired: true,
            model: modelState.summary
        },
        input: {
            locator: String(locator || ''),
            stepGoal: String(stepGoal || ''),
            htmlSnippetLength: String(htmlSnippet || '').length
        },
        analysis: {
            locatorFamily: originalSignals.family,
            detectedSignals: buildDetectedSignals(originalSignals),
            candidateCount: candidates.length,
            warnings,
            autoHealReadyCount: suggestions.filter((suggestion) => suggestion.healDecision && suggestion.healDecision.autoApplyEligible).length
        },
        suggestions,
        generatedAt: new Date().toISOString()
    };
}

function trainAndPersistLocatorRepairModel(options = {}) {
    const mode = typeof options.mode === 'string' && options.mode.trim()
        ? options.mode.trim().toLowerCase()
        : 'hybrid';
    const safeMode = ['bootstrap', 'hybrid'].includes(mode) ? mode : 'hybrid';
    const bootstrapExamples = buildBootstrapTrainingExamples();
    const history = loadLocatorRepairHistory({ historyPath: options.historyPath });
    const historyExamples = safeMode === 'bootstrap'
        ? []
        : buildHistoryTrainingExamples(history.entries);
    const allExamples = safeMode === 'bootstrap'
        ? bootstrapExamples
        : bootstrapExamples.concat(historyExamples);
    const model = trainLocatorRepairModel(allExamples, {
        learningRate: safeMode === 'bootstrap' ? 0.34 : 0.31,
        epochs: safeMode === 'bootstrap' ? 520 : 440
    });
    const savedPath = saveLocatorRepairModel(model, { modelPath: options.modelPath });

    cachedBootstrapModel = null;
    clearLocatorRepairModelCache();

    return {
        mode: safeMode,
        savedPath,
        bootstrapExamples: bootstrapExamples.length,
        historyExamples: historyExamples.length,
        feedbackEntries: history.entries.length,
        labels: {
            positive: allExamples.filter((example) => Number(example.label) > 0).length,
            negative: allExamples.filter((example) => Number(example.label) <= 0).length
        },
        sources: model.sources || {},
        model: buildModelSummary(model, {
            source: 'persisted',
            modelPath: options.modelPath
        }),
        history: summarizeLocatorRepairHistory(history, {
            limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8
        })
    };
}

function findSelectedSuggestion(suggestions = [], options = {}) {
    if (options.selectedFingerprint) {
        return suggestions.find((suggestion) => suggestion.candidate && suggestion.candidate.fingerprint === options.selectedFingerprint) || null;
    }

    if (Number.isFinite(Number(options.suggestionRank)) && Number(options.suggestionRank) > 0) {
        return suggestions.find((suggestion) => suggestion.rank === Number(options.suggestionRank)) || null;
    }

    return suggestions[0] || null;
}

function recordLocatorRepairFeedback({
    locator,
    stepGoal = '',
    htmlSnippet = '',
    selectedFingerprint = '',
    suggestionRank = 1,
    feedbackLabel = 'accepted',
    verified = false,
    framework = '',
    route = '',
    scenarioId = '',
    notes = '',
    modelPath,
    historyPath,
    autoTrain = true
} = {}) {
    const safeFeedbackLabel = ALLOWED_FEEDBACK_LABELS.includes(feedbackLabel)
        ? feedbackLabel
        : 'accepted';
    const suggestionResult = suggestLocatorRepairs({
        locator,
        stepGoal,
        htmlSnippet,
        modelPath
    });
    const selectedSuggestion = findSelectedSuggestion(suggestionResult.suggestions, {
        selectedFingerprint,
        suggestionRank
    });

    if (!selectedSuggestion) {
        throw new Error('The selected suggestion could not be found in the current repair results.');
    }

    const entry = appendLocatorRepairHistoryEntry({
        feedbackLabel: safeFeedbackLabel,
        verified: safeFeedbackLabel === 'healed' ? true : Boolean(verified),
        framework,
        route,
        scenarioId,
        locatorFamily: suggestionResult.analysis.locatorFamily,
        selectedRank: selectedSuggestion.rank,
        selectedFingerprint: selectedSuggestion.candidate && selectedSuggestion.candidate.fingerprint
            ? selectedSuggestion.candidate.fingerprint
            : selectedFingerprint,
        request: {
            locator: String(locator || ''),
            stepGoal: String(stepGoal || ''),
            htmlSnippet: String(htmlSnippet || '')
        },
        selectedCandidate: selectedSuggestion.candidate,
        primaryLocator: selectedSuggestion.primaryLocator,
        heuristicScore: selectedSuggestion.heuristicScore,
        modelScore: selectedSuggestion.ml && selectedSuggestion.ml.score ? selectedSuggestion.ml.score : 0,
        hybridScore: selectedSuggestion.hybrid && selectedSuggestion.hybrid.score ? selectedSuggestion.hybrid.score : 0,
        confidence: selectedSuggestion.confidence,
        healDecision: selectedSuggestion.healDecision,
        notes
    }, {
        historyPath
    });

    const trainingResult = autoTrain
        ? trainAndPersistLocatorRepairModel({
            mode: 'hybrid',
            modelPath,
            historyPath
        })
        : null;

    return {
        entry,
        history: getLocatorRepairHistory({ historyPath, limit: 8 }),
        model: trainingResult
            ? trainingResult.model
            : getRuntimeModelState({ modelPath }).summary
    };
}

module.exports = {
    DEFAULT_ENGINE_MODE,
    DEFAULT_SAMPLE_ID,
    buildBootstrapTrainingExamples,
    buildCandidateFingerprint,
    buildLocatorRepairModuleOverview,
    getLocatorRepairHistory,
    getRuntimeModelState,
    getSampleCase,
    getSampleCaseIds,
    recordLocatorRepairFeedback,
    suggestLocatorRepairs,
    trainAndPersistLocatorRepairModel
};
