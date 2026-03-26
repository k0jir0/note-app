const { expect } = require('chai');

const injectionPreventionResearchService = require('../src/services/injectionPreventionResearchService');

describe('Injection prevention research service', () => {
    it('builds module overview data with database posture and safe query guidance', () => {
        const fakeMongoose = {
            get(key) {
                return key === 'sanitizeFilter' || key === 'strictQuery';
            }
        };

        const overview = injectionPreventionResearchService.buildInjectionPreventionModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/',
            mongooseLib: fakeMongoose
        });

        expect(overview.module.name).to.equal('Injection Prevention Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.database.engine).to.equal('MongoDB');
        expect(overview.database.posture.sanitizeFilter).to.equal(true);
        expect(overview.database.posture.strictQuery).to.equal(true);
        expect(overview.controls).to.have.length(5);
        expect(overview.queryPatterns).to.have.length(2);
        expect(overview.scenarios).to.have.length(3);
        expect(overview.defaultScenarioId).to.equal('nosql-operator-body');
        expect(overview.defaultEvaluation.decision).to.equal('reject');
    });

    it('rejects operator-shaped sample payloads', () => {
        const evaluation = injectionPreventionResearchService.evaluateInjectionScenario({
            scenarioId: 'nosql-operator-body'
        });

        expect(evaluation.blocked).to.equal(true);
        expect(evaluation.decision).to.equal('reject');
        expect(evaluation.findings[0].path).to.equal('user.$ne');
    });

    it('allows the validated owned-note sample', () => {
        const evaluation = injectionPreventionResearchService.evaluateInjectionScenario({
            scenarioId: 'validated-owned-note-query'
        });

        expect(evaluation.blocked).to.equal(false);
        expect(evaluation.decision).to.equal('allow');
        expect(evaluation.findings).to.deep.equal([]);
    });
});
