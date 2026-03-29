const { expect } = require('chai');

const { createPersistentAuditClient, listAuditEventsForUser } = require('../src/services/persistentAuditService');

describe('persistent audit service', () => {
    it('persists events locally and forwards them to the base client', async () => {
        const createdDocs = [];
        const forwarded = [];
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
            osLib: { hostname: () => 'audit-host' },
            clock: () => new Date('2026-03-29T20:00:00.000Z')
        });

        const result = await client.audit('Database state changed', {
            category: 'db-state-change',
            userId: '507f1f77bcf86cd799439011',
            method: 'POST',
            path: '/api/notes/507f1f77bcf86cd799439012'
        });

        expect(result).to.equal(true);
        expect(createdDocs).to.have.length(1);
        expect(createdDocs[0].category).to.equal('db-state-change');
        expect(createdDocs[0].path).to.equal('/api/notes/507f1f77bcf86cd799439012');
        expect(createdDocs[0].entryHash).to.be.a('string').with.length.greaterThan(10);
        expect(forwarded).to.have.length(1);
        expect(forwarded[0].level).to.equal('audit');
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
