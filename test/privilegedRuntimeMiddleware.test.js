const { expect } = require('chai');

const {
    requirePrivilegedRuntimeMutationAccess,
    requireRecentPrivilegedStepUp
} = require('../src/middleware/privilegedRuntime');

function buildJsonResponseDouble() {
    return {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return body;
        },
        send(body) {
            this.payload = body;
            return body;
        }
    };
}

describe('privileged runtime middleware', () => {
    it('audits denied privileged runtime mutations', (done) => {
        const auditEvents = [];
        const middleware = requirePrivilegedRuntimeMutationAccess();
        const req = {
            method: 'POST',
            path: '/api/runtime/realtime',
            originalUrl: '/api/runtime/realtime',
            ip: '203.0.113.7',
            headers: {
                'user-agent': 'mocha-privileged-runtime'
            },
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'analyst@example.com',
                accessProfile: {
                    missionRole: 'analyst'
                }
            },
            app: {
                locals: {
                    immutableLogClient: {
                        enabled: true,
                        audit: async (message, metadata) => {
                            auditEvents.push({ message, metadata });
                            return true;
                        }
                    }
                }
            },
            get(name) {
                return this.headers[String(name).toLowerCase()];
            }
        };
        const res = buildJsonResponseDouble();

        middleware(req, res, () => {});

        setTimeout(() => {
            expect(res.statusCode).to.equal(403);
            expect(res.payload.message).to.equal('Privileged runtime changes require an admin session.');
            expect(auditEvents).to.have.length(1);
            expect(auditEvents[0].message).to.equal('Privileged runtime changes require an admin session.');
            expect(auditEvents[0].metadata).to.deep.include({
                category: 'authorization',
                outcome: 'denied',
                userId: '507f1f77bcf86cd799439011',
                method: 'POST',
                path: '/api/runtime/realtime',
                statusCode: 403
            });
            expect(auditEvents[0].metadata.what).to.deep.include({
                intent: 'privileged-runtime',
                actionId: 'mutate_privileged_runtime',
                resourceId: 'runtime-configuration',
                decision: 'deny',
                reason: 'admin_session_required'
            });
            done();
        }, 10);
    });

    it('audits denied privileged actions that are missing a recent hardware-first step-up', (done) => {
        const auditEvents = [];
        const middleware = requireRecentPrivilegedStepUp();
        const req = {
            method: 'POST',
            path: '/api/runtime/break-glass',
            originalUrl: '/api/runtime/break-glass',
            ip: '203.0.113.8',
            headers: {
                'user-agent': 'mocha-step-up'
            },
            session: {},
            user: {
                _id: '507f1f77bcf86cd799439099',
                email: 'admin@example.com',
                accessProfile: {
                    missionRole: 'admin'
                }
            },
            app: {
                locals: {
                    immutableLogClient: {
                        enabled: true,
                        audit: async (message, metadata) => {
                            auditEvents.push({ message, metadata });
                            return true;
                        }
                    }
                }
            },
            get(name) {
                return this.headers[String(name).toLowerCase()];
            }
        };
        const res = buildJsonResponseDouble();

        middleware(req, res, () => {});

        setTimeout(() => {
            expect(res.statusCode).to.equal(403);
            expect(res.payload.message).to.equal('A recent hardware-first MFA step-up is required for this privileged action.');
            expect(auditEvents).to.have.length(1);
            expect(auditEvents[0].metadata.what).to.deep.include({
                actionId: 'perform_privileged_runtime_action',
                resourceId: 'hardware-step-up-window',
                reason: 'recent_hardware_step_up_required'
            });
            expect(auditEvents[0].metadata.how.recentHardwareStepUp).to.equal(false);
            done();
        }, 10);
    });
});
