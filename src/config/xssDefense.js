function escapeHtmlForRendering(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function cloneDirectives(directives = {}) {
    return Object.fromEntries(
        Object.entries(directives).map(([key, value]) => [
            key,
            Array.isArray(value) ? [...value] : value
        ])
    );
}

function buildContentSecurityPolicyDirectives() {
    return {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\''],
        scriptSrcAttr: ['\'none\''],
        styleSrc: ['\'self\''],
        styleSrcAttr: ['\'none\''],
        imgSrc: ['\'self\'', 'data:'],
        fontSrc: ['\'self\'', 'data:'],
        connectSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        baseUri: ['\'self\''],
        formAction: ['\'self\''],
        frameAncestors: ['\'none\''],
        frameSrc: ['\'none\''],
        manifestSrc: ['\'self\''],
        workerSrc: ['\'self\'']
    };
}

function buildHelmetProtectionOptions({ isProduction = false } = {}) {
    return {
        contentSecurityPolicy: {
            directives: buildContentSecurityPolicyDirectives()
        },
        hsts: isProduction ? undefined : false
    };
}

function summarizeDirectiveList(directives = {}) {
    return Object.entries(directives).map(([name, values]) => ({
        name,
        value: Array.isArray(values) ? values.join(' ') : String(values)
    }));
}

module.exports = {
    buildContentSecurityPolicyDirectives,
    buildHelmetProtectionOptions,
    cloneDirectives,
    escapeHtmlForRendering,
    summarizeDirectiveList
};
