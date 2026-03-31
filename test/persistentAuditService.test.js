const { expect } = require('chai');

const { createPersistentAuditClient, listAuditEventsForUser } = require('../src/services/persistentAuditService');

function createChainStateModel() {
    const state = {
        chainKey: 'default',
        sequence: 0,
        lastHash: ''
    };

    function wrap(value) {
        return {
            lean: async () => value
        };
    }

    return {
        findOneAndUpdate(filter, update = {}, options = {}) {
            if (options.upsert && update.$setOnInsert) {
                state.chainKey = update.$setOnInsert.chainKey || state.chainKey;
                state.sequence = Number.isFinite(Number(state.sequence)) ? state.sequence : 0;
                state.lastHash = String(state.lastHash || '');
                return wrap({ ...state });
            }

            const matches = filter.chainKey === state.chainKey
                && Number(filter.sequence) === state.sequence
                && String(filter.lastHash || '') === state.lastHash;

            if (!matches) {
                return wrap(null);
            }

            Object.assign(state, update.$set || {});
            return wrap({ ...state });
        },
        findOne(filter = {}) {
            return wrap(filter.chainKey === state.chainKey ? { ...state } : null);
        },
        updateOne(filter = {}, update = {}) {
            const matches = filter.chainKey === state.chainKey
                && Number(filter.sequence) === state.sequence
                && String(filter.lastHash || '') === state.lastHash;

            if (matches) {
                Object.assign(state, update.$set || {});
            }

            return Promise.resolve({
                modifiedCount: matches ? 1 : 0
            });
        }
    };
}

describe('persistent audit service', () => {
    it('persists events locally and forwards them to the base client', async () => {
        const createdDocs = [];
        const forwarded = [];
        const chainStateModel = createChainStateModel();
        const client = createPersistentAuditClient({
            baseClient: {
                enabled: true,
                capture: async (level, message, metadata) => {
                    forwarded.push({ level, message, metadata });
                    return true;
                }
            },
            AuditEventModel: {
                create: async (doc) => {
                    createdDocs.push(doc);
                    return doc;
                }
            },
            AuditChainStateModel: chainStateModel,
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:00:00.000Z')
        });

        const result = await client.audit('Database state changed', {
            category: 'db-state-change',
            userId: '507f1f77bcf86cd799439011',
            correlationId: 'corr-persist-11',
            method: 'POST',
            path: '/api/notes/507f1f77bcf86cd799439012'
        });

        expect(result).to.equal(true);
        expect(createdDocs).to.have.length(1);
        expect(createdDocs[0].category).to.equal('db-state-change');
        expect(createdDocs[0].path).to.equal('/api/notes/507f1f77bcf86cd799439012');
        expect(createdDocs[0].correlationId).to.equal('corr-persist-11');
        expect(createdDocs[0].sequence).to.equal(1);
        expect(createdDocs[0].previousHash).to.equal('');
        expect(createdDocs[0].entryHash).to.be.a('string').with.length.greaterThan(10);
        expect(forwarded).to.have.length(1);
        expect(forwarded[0].level).to.equal('audit');
    });

    it('continues the persisted audit hash chain across client instances', async () => {
        const createdDocs = [];
        const chainStateModel = createChainStateModel();
        const auditEventModel = {
            create: async (doc) => {
                createdDocs.push(doc);
                return doc;
            }
        };

        const firstClient = createPersistentAuditClient({
            AuditEventModel: auditEventModel,
            AuditChainStateModel: chainStateModel,
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:00:00.000Z')
        });
        const secondClient = createPersistentAuditClient({
            AuditEventModel: auditEventModel,
            AuditChainStateModel: chainStateModel,
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:01:00.000Z')
        });

        await firstClient.audit('First event', {
            category: 'http-request'
        });
        await secondClient.audit('Second event', {
            category: 'http-request'
        });

        expect(createdDocs).to.have.length(2);
        expect(createdDocs[0].sequence).to.equal(1);
        expect(createdDocs[1].sequence).to.equal(2);
        expect(createdDocs[1].previousHash).to.equal(createdDocs[0].entryHash);
    });

    it('can require both local persistence and remote forwarding for success', async () => {
        const client = createPersistentAuditClient({
            baseClient: {
                enabled: true,
                capture: async () => false
            },
            requireRemoteSuccess: true,
            AuditEventModel: {
                create: async (doc) => doc
            },
            AuditChainStateModel: createChainStateModel(),
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:00:00.000Z')
        });

        const result = await client.audit('Database state changed', {
            category: 'db-state-change'
        });

        expect(result).to.equal(false);
    });

    it('can throw on required immutable audit delivery failures in strict mode', async () => {
        const failures = [];
        const client = createPersistentAuditClient({
            baseClient: {
                enabled: true,
                capture: async () => false
            },
            requireRemoteSuccess: true,
            throwOnRequiredFailure: true,
            onRequiredFailure: async (error) => {
                failures.push(error);
            },
            AuditEventModel: {
                create: async (doc) => doc
            },
            AuditChainStateModel: createChainStateModel(),
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:00:00.000Z')
        });

        try {
            await client.audit('Database state changed', {
                category: 'db-state-change'
            });
            expect.fail('Expected strict audit delivery to reject');
        } catch (error) {
            expect(error.code).to.equal('REQUIRED_AUDIT_DELIVERY_FAILED');
            expect(error.auditDelivery).to.deep.include({
                level: 'audit',
                message: 'Database state changed',
                persisted: true,
                forwarded: false
            });
            expect(failures).to.have.length(1);
            expect(failures[0]).to.equal(error);
        }
    });

    it('lists persisted events for a user with pagination', async () => {
        const expectedEvents = [{ _id: 'evt-1', message: 'HTTP request completed' }];
        const queryState = {};
        const result = await listAuditEventsForUser('507f1f77bcf86cd799439011', {
            page: 2,
            limit: 5,
            level: 'audit',
            category: 'http-request',
            AuditEventModel: {
                find: (query) => {
                    queryState.query = query;
                    return {
                        sort: () => ({
                            skip: (skip) => {
                                queryState.skip = skip;
                                return {
                                    limit: async (limit) => {
                                        queryState.limit = limit;
                                        return expectedEvents;
                                    }
                                };
                            }
                        })
                    };
                },
                countDocuments: async (query) => {
                    queryState.countQuery = query;
                    return 9;
                }
            }
        });

        expect(queryState.query.subjectUser).to.equal('507f1f77bcf86cd799439011');
        expect(queryState.query.level).to.equal('audit');
        expect(queryState.query.category).to.equal('http-request');
        expect(queryState.skip).to.equal(5);
        expect(queryState.limit).to.equal(5);
        expect(result.events).to.deep.equal(expectedEvents);
        expect(result.totalCount).to.equal(9);
        expect(result.page).to.equal(2);
    });
});
