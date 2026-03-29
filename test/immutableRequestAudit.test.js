const { expect } = require('chai');

const { createImmutableRequestAuditMiddleware } = require('../src/middleware/immutableRequestAudit');

describe('immutable request audit middleware', () => {
    it('forwards security-relevant request completions to the immutable log sink', (done) => {
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
            headers: {
                'user-agent': 'mocha-test',
                'x-forwarded-for': '203.0.113.99'
            },
            user: { _id: '507f1f77bcf86cd799439011' },
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

        middleware(req, res, () => {
            setTimeout(() => {
                expect(entries).to.have.length(1);
                expect(entries[0].message).to.equal('HTTP request completed');
                expect(entries[0].metadata).to.deep.include({
                    category: 'http-request',
                    method: 'POST',
                    path: '/api/security/log-analysis',
                    statusCode: 202,
                    userId: '507f1f77bcf86cd799439011',
                    ip: '203.0.113.99',
                    userAgent: 'mocha-test'
                });
                done();
            }, 10);
        });
    });
});
