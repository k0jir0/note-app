const { expect } = require('chai');

const xssDefenseResearchService = require('../src/services/xssDefenseResearchService');

describe('XSS defense research service', () => {
    it('builds overview data with enforced CSP and escaped template posture', () => {
        const overview = xssDefenseResearchService.buildXssDefenseModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/'
        });

        expect(overview.module.name).to.equal('XSS and CSP Defense Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.csp.enforced).to.equal(true);
        expect(overview.csp.directives.scriptSrc).to.deep.equal(['\'self\'']);
        expect(overview.csp.directives.scriptSrcAttr).to.deep.equal(['\'none\'']);
        expect(overview.rendering.serverTemplates.escapedInterpolationOnly).to.equal(true);
        expect(overview.rendering.clientRendering.inlineStyleTemplateFiles).to.deep.equal([]);
        expect(overview.sovereignty.selfHostedAssetsOnly).to.equal(true);
        expect(overview.sovereignty.externalAssetReferences).to.deep.equal([]);
        expect(overview.controls).to.have.length(6);
        expect(overview.scenarios).to.be.an('array').that.is.not.empty;
    });

    it('marks script-tag payloads as escape-and-restrict and encodes the preview', () => {
        const evaluation = xssDefenseResearchService.evaluateXssScenario({
            scenarioId: 'script-tag-note-title'
        });

        expect(evaluation.decision).to.equal('escape-and-restrict');
        expect(evaluation.dangerSignals.map((signal) => signal.id)).to.include('script-tag');
        expect(evaluation.escapedPreview).to.include('&lt;script&gt;');
        expect(evaluation.cspOutcome.scriptExecutionBlocked).to.equal(true);
    });

    it('marks plain-text content as render-safe', () => {
        const evaluation = xssDefenseResearchService.evaluateXssScenario({
            scenarioId: 'safe-mission-summary'
        });

        expect(evaluation.decision).to.equal('render-safe');
        expect(evaluation.dangerSignals).to.deep.equal([]);
        expect(evaluation.summary).to.include('renders safely');
    });
});
