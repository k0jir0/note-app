const ACCOUNT_STATUSES = Object.freeze({
    ACTIVE: 'active',
    DISABLED: 'disabled'
});

function normalizeAccountStatus(user = {}) {
    const accountState = user && user.accountState && typeof user.accountState === 'object'
        ? user.accountState
        : {};
    const normalized = String(accountState.status || ACCOUNT_STATUSES.ACTIVE).trim().toLowerCase();

    return normalized === ACCOUNT_STATUSES.DISABLED
        ? ACCOUNT_STATUSES.DISABLED
        : ACCOUNT_STATUSES.ACTIVE;
}

function isAccountDisabled(user = {}) {
    return normalizeAccountStatus(user) === ACCOUNT_STATUSES.DISABLED;
}

function getAccountDisabledReason(user = {}) {
    const accountState = user && user.accountState && typeof user.accountState === 'object'
        ? user.accountState
        : {};

    return String(accountState.disabledReason || '').trim();
}

module.exports = {
    ACCOUNT_STATUSES,
    getAccountDisabledReason,
    isAccountDisabled,
    normalizeAccountStatus
};
