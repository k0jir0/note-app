const { expect } = require('chai');

const { createImmutableRequestAuditMiddleware } = require('../src/middleware/immutableRequestAudit');
const { requestContextMiddleware } = require('../src/utils/requestContext');

describe('immutable request audit middleware', () => {
    it('forwards semantic, correlation-aware request completions to the immutable log sink', (done) => {
        const entries = [];
        const middleware = createImmutableRequestAuditMiddleware({
            client: {
                enabled: true,
                audit: async (message, metadata) => {
                    entries.push({ message, metadata });
                    return true;
                }
            }
        });

        const req = {
            method: 'POST',
            path: '/api/security/log-analysis',
            originalUrl: '/api/security/log-analysis',
            ip: '203.0.113.99',
            headers: {
                'user-agent': 'mocha-test',
                'x-forwarded-for': '203.0.113.99',
                'x-correlation-id': 'corr-audit-9'
            },
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'operator@example.com',
                accessProfile: {
                    missionRole: 'analyst',
                    mfaMethod: 'hardware_token',
                    mfaAssurance: 'hardware_first',
                    hardwareTokenLabel: 'MissionKey'
                }
            },
            missionAccessDecision: {
                allowed: true,
                action: {
                    id: 'view_mission_data',
                    label: 'View Mission Data'
                },
                resource: {
                    id: 'mission-data-42',
                    title: 'Mission Data 42'
                },
                failedChecks: [],
                summary: 'Operator may view Mission Data 42.'
            },
            get(name) {
                return this.headers[String(name).toLowerCase()];
            }
        };
        const res = {
            statusCode: 202,
            on(eventName, handler) {
                if (eventName === 'finish') {
                    setImmediate(handler);
                }
            }
        };

        requestContextMiddleware(req, {}, () => {
            middleware(req, res, () => {
                setTimeout(() => {
                    expect(entries).to.have.length(1);
                    expect(entries[0].message).to.equal('User 507f1f77bcf86cd799439011 authorized to view mission data on Mission Data 42 via hardware token MissionKey.');
                    expect(entries[0].metadata).to.deep.include({
                        category: 'http-request',
                        outcome: 'authorized',
                        method: 'POST',
                        path: '/api/security/log-analysis',
                        statusCode: 202,
                        userId: '507f1f77bcf86cd799439011',
                        ip: '203.0.113.99',
                        userAgent: 'mocha-test',
                        correlationId: 'corr-audit-9'
                    });
                    expect(entries[0].metadata.what).to.deep.include({
                        intent: 'mission-access',
                        actionId: 'view_mission_data',
                        resourceId: 'mission-data-42',
                        decision: 'allow'
                    });
                    expect(entries[0].metadata.where.correlationId).to.equal('corr-audit-9');
                    expect(entries[0].metadata.requestId).to.be.a('string').and.not.empty;
                    done();
                }, 10);
            });
        });
    });

    it('swallows asynchronous audit sink rejections after the response completes', (done) => {
        const middleware = createImmutableRequestAuditMiddleware({
            client: {
                enabled: true,
                audit: async () => {
                    throw new Error('required audit delivery failed');
                }
            }
        });
        const req = {
            method: 'POST',
            path: '/api/notes',
            originalUrl: '/api/notes',
            headers: {},
            get() {
                return '';
            }
        };
        const res = {
            statusCode: 201,
            on(eventName, handler) {
                if (eventName === 'finish') {
                    setImmediate(handler);
                }
            }
        };

        middleware(req, res, () => {
            setTimeout(() => done(), 10);
        });
    });
});
