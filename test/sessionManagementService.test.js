const { expect } = require('chai');

const {
    SESSION_LOCK_REASONS,
    beginAuthenticatedSession,
    buildCurrentSessionState,
    buildSessionPolicy,
    clearCurrentSessionBinding
} = require('../src/services/sessionManagementService');

describe('Session management service', () => {
    it('builds a stricter field-session policy outside the corp zone', () => {
        const policy = buildSessionPolicy({
            user: {
                accessProfile: {
                    networkZones: ['mission']
                }
            },
            session: {},
            runtimeConfig: {
                sessionManagement: {
                    idleTimeoutMs: 15 * 60 * 1000,
                    absoluteTimeoutMs: 8 * 60 * 60 * 1000,
                    missionIdleTimeoutMs: 5 * 60 * 1000,
                    missionAbsoluteTimeoutMs: 2 * 60 * 60 * 1000,
                    preventConcurrentLogins: true
                }
            }
        });

        expect(policy.networkZone).to.equal('mission');
        expect(policy.fieldDeployed).to.equal(true);
        expect(policy.idleTimeoutMs).to.equal(5 * 60 * 1000);
        expect(policy.absoluteTimeoutMs).to.equal(2 * 60 * 60 * 1000);
        expect(policy.preventConcurrentLogins).to.equal(true);
    });

    it('starts a tracked authenticated session and binds it to the user record', async () => {
        const session = {};
        const user = {
            _id: '507f1f77bcf86cd799439011',
            email: 'tester@example.com'
        };

        const state = await beginAuthenticatedSession({
            user,
            session,
            runtimeConfig: {}
        });

        expect(state.tracked).to.equal(true);
        expect(state.valid).to.equal(true);
        expect(state.sessionId).to.match(/^sess-/);
        expect(session.sessionManagement.sessionId).to.equal(state.sessionId);
        expect(user.sessionControl.activeSessionId).to.equal(state.sessionId);
    });

    it('marks a session invalid after the idle timeout expires', async () => {
        const now = Date.now();
        const session = {
            sessionManagement: {
                sessionId: 'sess-old',
                userId: '507f1f77bcf86cd799439011',
                networkZone: 'corp',
                issuedAt: new Date(now - (30 * 60 * 1000)).toISOString(),
                lastActivityAt: new Date(now - (20 * 60 * 1000)).toISOString(),
                idleTimeoutMs: 15 * 60 * 1000,
                absoluteTimeoutMs: 8 * 60 * 60 * 1000
            }
        };

        const state = buildCurrentSessionState({
            user: {
                sessionControl: {
                    activeSessionId: 'sess-old'
                }
            },
            session,
            runtimeConfig: {},
            now
        });

        expect(state.valid).to.equal(false);
        expect(state.lockReason).to.equal(SESSION_LOCK_REASONS.IDLE_TIMEOUT);
    });

    it('marks a session invalid when a newer login supersedes it', () => {
        const now = Date.now();
        const session = {
            sessionManagement: {
                sessionId: 'sess-original',
                userId: '507f1f77bcf86cd799439011',
                networkZone: 'corp',
                issuedAt: new Date(now - (10 * 60 * 1000)).toISOString(),
                lastActivityAt: new Date(now - (1 * 60 * 1000)).toISOString(),
                idleTimeoutMs: 15 * 60 * 1000,
                absoluteTimeoutMs: 8 * 60 * 60 * 1000
            }
        };

        const state = buildCurrentSessionState({
            user: {
                sessionControl: {
                    activeSessionId: 'sess-newer'
                }
            },
            session,
            runtimeConfig: {},
            now
        });

        expect(state.valid).to.equal(false);
        expect(state.supersededByNewLogin).to.equal(true);
        expect(state.lockReason).to.equal(SESSION_LOCK_REASONS.CONCURRENT_LOGIN);
    });

    it('clears the active-session binding when the current session logs out', async () => {
        const session = {
            sessionManagement: {
                sessionId: 'sess-current'
            }
        };
        const user = {
            sessionControl: {
                activeSessionId: 'sess-current'
            }
        };

        const cleared = await clearCurrentSessionBinding({
            user,
            session,
            reason: SESSION_LOCK_REASONS.MANUAL_LOCKDOWN
        });

        expect(cleared).to.equal(true);
        expect(user.sessionControl.activeSessionId).to.equal('');
        expect(user.sessionControl.lastLockReason).to.equal(SESSION_LOCK_REASONS.MANUAL_LOCKDOWN);
    });
});
