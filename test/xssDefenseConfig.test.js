const { expect } = require('chai');

const {
    buildContentSecurityPolicyDirectives,
    buildHelmetProtectionOptions
} = require('../src/config/xssDefense');

describe('XSS defense config', () => {
    it('builds strict CSP directives for script execution', () => {
        const directives = buildContentSecurityPolicyDirectives();

        expect(directives.defaultSrc).to.deep.equal(['\'self\'']);
        expect(directives.scriptSrc).to.deep.equal(['\'self\'']);
        expect(directives.scriptSrcAttr).to.deep.equal(['\'none\'']);
        expect(directives.styleSrc).to.deep.equal(['\'self\'']);
        expect(directives.styleSrcAttr).to.deep.equal(['\'none\'']);
        expect(directives.imgSrc).to.deep.equal(['\'self\'', 'data:']);
        expect(directives.fontSrc).to.deep.equal(['\'self\'', 'data:']);
        expect(directives.connectSrc).to.deep.equal(['\'self\'']);
        expect(directives.objectSrc).to.deep.equal(['\'none\'']);
        expect(directives.baseUri).to.deep.equal(['\'self\'']);
        expect(directives.formAction).to.deep.equal(['\'self\'']);
        expect(directives.frameAncestors).to.deep.equal(['\'none\'']);
        expect(directives.frameSrc).to.deep.equal(['\'none\'']);
        expect(directives.manifestSrc).to.deep.equal(['\'self\'']);
        expect(directives.workerSrc).to.deep.equal(['\'self\'']);
    });

    it('disables hsts outside production while keeping CSP enabled', () => {
        const options = buildHelmetProtectionOptions({ isProduction: false });

        expect(options.hsts).to.equal(false);
        expect(options.contentSecurityPolicy.directives.scriptSrc).to.deep.equal(['\'self\'']);
    });
});
