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

module.exports = {
    extractInteractiveElements,
    normalizeComparable,
    parseLocatorSignals,
    tokenize
};
