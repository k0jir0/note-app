const { expect } = require('chai');

const breakGlassResearchService = require('../src/services/breakGlassResearchService');

describe('Break-glass research service', () => {
    it('builds operator-facing overview data from the current state', () => {
        const overview = breakGlassResearchService.buildBreakGlassModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/',
            breakGlass: {
                mode: 'read_only',
                enabled: true,
                readOnly: true,
                offline: false,
                reason: 'Preserve evidence',
                activatedAt: '2026-03-30T18:00:00.000Z',
                activatedBy: 'admin@example.com'
            },
            user: {
                accessProfile: {
                    missionRole: 'admin'
                }
            }
        });

        expect(overview.module.name).to.equal('Break-Glass and Emergency Control Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.state.mode).to.equal('read_only');
        expect(overview.state.enabled).to.equal(true);
        expect(overview.controls.canToggle).to.equal(true);
        expect(overview.controls.allowedModes.map((mode) => mode.id)).to.deep.equal(['disabled', 'read_only', 'offline']);
        expect(overview.controls.safeBypassPaths).to.include('/healthz');
    });
});
