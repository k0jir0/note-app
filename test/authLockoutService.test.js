const { expect } = require('chai');

const {
    LOCKOUT_DURATION_MS,
    MAX_FAILED_LOGIN_ATTEMPTS,
    clearFailedLoginAttempts,
    getLockoutRemainingMs,
    isAccountLocked,
    recordFailedLoginAttempt
} = require('../src/services/authLockoutService');

function buildUser() {
    return {
        authenticationState: {},
        markModified() {},
        save: async function save() {
            return this;
        }
    };
}

describe('auth lockout service', () => {
    it('locks the account after repeated failed login attempts', async () => {
        const user = buildUser();
        const baseTime = Date.parse('2026-03-31T15:00:00.000Z');

        for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
            await recordFailedLoginAttempt(user, {
                now: baseTime + (attempt * 1000),
                ipAddress: '203.0.113.10'
            });
        }

        expect(isAccountLocked(user, { now: baseTime + 4000 })).to.equal(true);
        expect(getLockoutRemainingMs(user, { now: baseTime + 4000 })).to.be.greaterThan(0);
        expect(user.authenticationState.lastFailedLoginIp).to.equal('203.0.113.10');
    });

    it('expires the lockout once the lockout window passes', async () => {
        const user = buildUser();
        const baseTime = Date.parse('2026-03-31T15:00:00.000Z');

        for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
            await recordFailedLoginAttempt(user, {
                now: baseTime + (attempt * 1000)
            });
        }

        expect(isAccountLocked(user, { now: baseTime + LOCKOUT_DURATION_MS + 5000 })).to.equal(false);
        expect(getLockoutRemainingMs(user, { now: baseTime + LOCKOUT_DURATION_MS + 5000 })).to.equal(0);
    });

    it('clears failed-attempt state after a successful login', async () => {
        const user = buildUser();
        const baseTime = Date.parse('2026-03-31T15:00:00.000Z');

        await recordFailedLoginAttempt(user, {
            now: baseTime
        });
        await clearFailedLoginAttempts(user, {
            now: baseTime + 1000
        });

        expect(user.authenticationState.failedLoginAttempts).to.equal(0);
        expect(user.authenticationState.lockoutUntil).to.equal(null);
        expect(user.authenticationState.lastSuccessfulLoginAt).to.be.instanceOf(Date);
    });
});
