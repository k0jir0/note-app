const { expect } = require('chai');

const sessionManagementResearchService = require('../src/services/sessionManagementResearchService');

describe('Session management research service', () => {
    it('builds module overview data with policy, session, and scenario coverage', () => {
        const overview = sessionManagementResearchService.buildSessionManagementModuleOverview({
            user: {
                email: 'tester@example.com',
                accessProfile: {
                    networkZones: ['corp']
                }
            },
            session: {},
            runtimeConfig: {},
            baseUrl: 'http://127.0.0.1:3000/'
        });

        expect(overview.module.name).to.equal('Session Management Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.policy.preventConcurrentLogins).to.equal(true);
        expect(overview.controls).to.have.length(4);
        expect(overview.scenarios).to.have.length(3);
        expect(overview.defaultScenarioId).to.equal('abandoned-field-terminal');
        expect(overview.defaultEvaluation.decision).to.equal('lock');
    });

    it('locks the abandoned-field-terminal scenario', () => {
        const evaluation = sessionManagementResearchService.evaluateSessionLockdownScenario({
            user: {
                accessProfile: {
                    networkZones: ['mission']
                }
            },
            runtimeConfig: {},
            scenarioId: 'abandoned-field-terminal'
        });

        expect(evaluation.locked).to.equal(true);
        expect(evaluation.failedChecks).to.include('idle-timeout');
    });

    it('keeps the headquarters session active when limits are not exceeded', () => {
        const evaluation = sessionManagementResearchService.evaluateSessionLockdownScenario({
            user: {
                accessProfile: {
                    networkZones: ['corp']
                }
            },
            runtimeConfig: {},
            scenarioId: 'active-headquarters-session'
        });

        expect(evaluation.locked).to.equal(false);
        expect(evaluation.decision).to.equal('allow');
    });
});
