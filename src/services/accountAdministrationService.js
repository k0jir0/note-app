const bcrypt = require('bcrypt');

const User = require('../models/User');
const { ACCOUNT_STATUSES } = require('./accountLifecycleService');

const PROVISIONED_ACCESS_PROFILE_DEFAULTS = Object.freeze({
    missionRole: 'operator',
    clearance: 'protected_b',
    unit: 'cyber-task-force',
    assignedMissions: [],
    deviceTier: 'managed',
    networkZones: ['corp']
});

function cloneArray(values = []) {
    return Array.isArray(values) ? [...values] : [];
}

function serializeAccessProfile(accessProfile = {}) {
    return {
        missionRole: String(accessProfile.missionRole || PROVISIONED_ACCESS_PROFILE_DEFAULTS.missionRole),
        clearance: String(accessProfile.clearance || PROVISIONED_ACCESS_PROFILE_DEFAULTS.clearance),
        unit: String(accessProfile.unit || PROVISIONED_ACCESS_PROFILE_DEFAULTS.unit),
        assignedMissions: cloneArray(accessProfile.assignedMissions),
        deviceTier: String(accessProfile.deviceTier || PROVISIONED_ACCESS_PROFILE_DEFAULTS.deviceTier),
        networkZones: cloneArray(accessProfile.networkZones)
    };
}

function buildProvisionedAccessProfile(overrides = {}) {
    return {
        ...PROVISIONED_ACCESS_PROFILE_DEFAULTS,
        ...overrides,
        assignedMissions: Array.isArray(overrides.assignedMissions)
            ? [...overrides.assignedMissions]
            : [...PROVISIONED_ACCESS_PROFILE_DEFAULTS.assignedMissions],
        networkZones: Array.isArray(overrides.networkZones)
            ? [...overrides.networkZones]
            : [...PROVISIONED_ACCESS_PROFILE_DEFAULTS.networkZones]
    };
}

function toAccountSummary(user = {}) {
    const accountState = user && user.accountState && typeof user.accountState === 'object'
        ? user.accountState
        : {};
    const accessProfile = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : {};

    return {
        id: String(user && user._id ? user._id : ''),
        email: String(user && user.email ? user.email : ''),
        name: String(user && user.name ? user.name : ''),
        googleLinked: Boolean(user && user.googleId),
        localPasswordEnabled: typeof user.password === 'string' && user.password.length > 0,
        accessProfile: serializeAccessProfile(accessProfile),
        accountState: {
            status: String(accountState.status || ACCOUNT_STATUSES.ACTIVE),
            disabledAt: accountState.disabledAt || null,
            disabledReason: String(accountState.disabledReason || ''),
            disabledBy: String(accountState.disabledBy || '')
        },
        createdAt: user && user.createdAt ? user.createdAt : null,
        updatedAt: user && user.updatedAt ? user.updatedAt : null
    };
}

async function listManagedAccounts() {
    const users = await User.find({}).sort({ email: 1 });
    return users.map((user) => toAccountSummary(user));
}

async function provisionManagedAccount({
    email,
    name = '',
    password = '',
    accessProfile = {},
    actor = ''
} = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const normalizedPassword = typeof password === 'string' ? password.trim() : '';
    const accessProfileOverrides = accessProfile && typeof accessProfile === 'object'
        ? accessProfile
        : {};
    const passwordHash = normalizedPassword
        ? await bcrypt.hash(normalizedPassword, 10)
        : '';
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        const mergedAccessProfile = {
            ...(existingUser.accessProfile && typeof existingUser.accessProfile.toObject === 'function'
                ? existingUser.accessProfile.toObject()
                : existingUser.accessProfile || {}),
            ...accessProfileOverrides
        };

        if (normalizedName) {
            existingUser.name = normalizedName;
        }

        if (passwordHash) {
            existingUser.password = passwordHash;
        }

        existingUser.accessProfile = mergedAccessProfile;
        existingUser.accountState = {
            status: ACCOUNT_STATUSES.ACTIVE,
            disabledAt: null,
            disabledReason: '',
            disabledBy: actor || ''
        };
        await existingUser.save();

        return {
            created: false,
            account: toAccountSummary(existingUser)
        };
    }

    const user = new User({
        email: normalizedEmail,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
        accessProfile: buildProvisionedAccessProfile(accessProfileOverrides),
        accountState: {
            status: ACCOUNT_STATUSES.ACTIVE,
            disabledAt: null,
            disabledReason: '',
            disabledBy: actor || ''
        }
    });

    await user.save();

    return {
        created: true,
        account: toAccountSummary(user)
    };
}

async function updateManagedAccountState({
    userId,
    status,
    reason = '',
    actor = ''
} = {}) {
    const user = await User.findById(userId);
    if (!user) {
        return null;
    }

    if (status === ACCOUNT_STATUSES.DISABLED) {
        const now = new Date();
        user.accountState = {
            status: ACCOUNT_STATUSES.DISABLED,
            disabledAt: now,
            disabledReason: String(reason || '').trim(),
            disabledBy: actor
        };
        user.sessionControl = {
            ...(user.sessionControl && typeof user.sessionControl.toObject === 'function'
                ? user.sessionControl.toObject()
                : user.sessionControl || {}),
            activeSessionId: '',
            activeSessionIssuedAt: null,
            lastLockReason: 'account_disabled',
            lastLockAt: now
        };
    } else {
        user.accountState = {
            status: ACCOUNT_STATUSES.ACTIVE,
            disabledAt: null,
            disabledReason: '',
            disabledBy: ''
        };
    }

    await user.save();
    return toAccountSummary(user);
}

module.exports = {
    PROVISIONED_ACCESS_PROFILE_DEFAULTS,
    buildProvisionedAccessProfile,
    listManagedAccounts,
    provisionManagedAccount,
    toAccountSummary,
    updateManagedAccountState
};
