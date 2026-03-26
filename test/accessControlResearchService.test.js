const { expect } = require('chai');

const accessControlResearchService = require('../src/services/accessControlResearchService');

describe('Access control research service', () => {
    it('builds module overview data with protected-route coverage', () => {
        const overview = accessControlResearchService.buildAccessControlModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/',
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: {
                    missionRole: 'analyst',
                    clearance: 'protected_b',
                    assignedMissions: ['research-workspace'],
                    deviceTier: 'managed',
                    networkZones: ['corp']
                }
            }
        });

        expect(overview.module.name).to.equal('Access Control Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.guard.protectedPrefixes).to.include('/api/');
        expect(overview.guard.publicExceptions).to.include('/__test/csrf');
        expect(overview.coverage.protectedRouteCount).to.be.greaterThan(0);
        expect(overview.routeCatalog.some((route) => route.path === '/api/notes')).to.equal(true);
        expect(overview.routeCatalog.some((route) => route.path === '/api/access-control/overview')).to.equal(true);
        expect(overview.controls).to.have.length(5);
    });

    it('denies the unauthenticated notes scenario with a 401 outcome', () => {
        const evaluation = accessControlResearchService.evaluateAccessControlScenario({
            scenarioId: 'unauthenticated-notes-api'
        });

        expect(evaluation.allowed).to.equal(false);
        expect(evaluation.httpStatus).to.equal(401);
        expect(evaluation.failedChecks).to.include('server-identity');
    });

    it('denies cross-user note access through ownership scoping', () => {
        const evaluation = accessControlResearchService.evaluateAccessControlScenario({
            scenarioId: 'cross-user-note-access'
        });

        expect(evaluation.allowed).to.equal(false);
        expect(evaluation.httpStatus).to.equal(404);
        expect(evaluation.failedChecks).to.include('resource-ownership');
    });

    it('allows the owned-note update scenario', () => {
        const evaluation = accessControlResearchService.evaluateAccessControlScenario({
            scenarioId: 'owned-note-update'
        });

        expect(evaluation.allowed).to.equal(true);
        expect(evaluation.httpStatus).to.equal(200);
        expect(evaluation.failedChecks).to.deep.equal([]);
    });
});
