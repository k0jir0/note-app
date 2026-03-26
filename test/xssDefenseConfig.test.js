const { expect } = require('chai');

const {
    buildContentSecurityPolicyDirectives,
    buildHelmetProtectionOptions
} = require('../src/config/xssDefense');

describe('XSS defense config', () => {
    it('builds strict CSP directives for script execution', () => {
        const directives = buildContentSecurityPolicyDirectives();

        expect(directives.scriptSrc).to.deep.equal(['\'self\'']);
        expect(directives.scriptSrcAttr).to.deep.equal(['\'none\'']);
        expect(directives.styleSrcAttr).to.deep.equal(['\'none\'']);
        expect(directives.objectSrc).to.deep.equal(['\'none\'']);
    });

    it('disables hsts outside production while keeping CSP enabled', () => {
        const options = buildHelmetProtectionOptions({ isProduction: false });

        expect(options.hsts).to.equal(false);
        expect(options.contentSecurityPolicy.directives.scriptSrc).to.deep.equal(['\'self\'']);
    });
});
