#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_PRIVILEGED_ROLES = ['admin', 'break_glass'];
const PRIVILEGED_USER_PROJECTION = [
    'email',
    'accessProfile.missionRole',
    'accessProfile.unit',
    'accessProfile.assignedMissions',
    'accessProfile.mfaVerifiedAt',
    'accessProfile.registeredHardwareToken',
    'accessProfile.registeredPkiCertificate',
    'accessProfile.breakGlassApproved',
    'accessProfile.breakGlassReason',
    'authenticationState.lockoutUntil',
    'authenticationState.lastSuccessfulLoginAt',
    'authenticationState.lastFailedLoginAt',
    'createdAt',
    'updatedAt'
].join(' ');

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const roles = readArgValue(argument, 'roles');
        if (roles) {
            return {
                ...options,
                roles: normalizeRoleList(roles.split(','))
            };
        }

        const previousReportFile = readArgValue(argument, 'previous-report');
        if (previousReportFile) {
            return {
                ...options,
                previousReportFile
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        outputFile: '',
        previousReportFile: '',
        roles: DEFAULT_PRIVILEGED_ROLES.slice()
    });
}

function normalizeRoleList(roles = []) {
    const normalizedRoles = roles
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean);

    return normalizedRoles.length ? Array.from(new Set(normalizedRoles)) : DEFAULT_PRIVILEGED_ROLES.slice();
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePrivilegedUser(user, { referenceTime = new Date() } = {}) {
    const accessProfile = user && user.accessProfile ? user.accessProfile : {};
    const authenticationState = user && user.authenticationState ? user.authenticationState : {};
    const lockoutUntil = toIsoString(
        authenticationState.lockoutUntil === undefined
            ? user && user.lockoutUntil
            : authenticationState.lockoutUntil
    );
    const referenceTimestamp = referenceTime instanceof Date
        ? referenceTime.getTime()
        : new Date(referenceTime).getTime();
    const lockoutTimestamp = lockoutUntil ? new Date(lockoutUntil).getTime() : 0;

    return {
        id: user && (user.id || user._id) ? String(user.id || user._id) : '',
        email: String(user && user.email ? user.email : ''),
        missionRole: String(user && user.missionRole ? user.missionRole : (accessProfile.missionRole || '')),
        unit: String(user && user.unit ? user.unit : (accessProfile.unit || '')),
        assignedMissions: Array.isArray(user && user.assignedMissions)
            ? user.assignedMissions.map((mission) => String(mission))
            : Array.isArray(accessProfile.assignedMissions)
                ? accessProfile.assignedMissions.map((mission) => String(mission))
                : [],
        breakGlassApproved: Boolean(
            user && user.breakGlassApproved !== undefined
                ? user.breakGlassApproved
                : accessProfile.breakGlassApproved
        ),
        breakGlassReasonSet: Boolean(
            user && user.breakGlassReasonSet !== undefined
                ? user.breakGlassReasonSet
                : String(accessProfile.breakGlassReason || '').trim()
        ),
        hardwareTokenRegistered: Boolean(
            user && user.hardwareTokenRegistered !== undefined
                ? user.hardwareTokenRegistered
                : accessProfile.registeredHardwareToken
        ),
        pkiCertificateRegistered: Boolean(
            user && user.pkiCertificateRegistered !== undefined
                ? user.pkiCertificateRegistered
                : accessProfile.registeredPkiCertificate
        ),
        strongFactorVerifiedAt: toIsoString(
            user && user.strongFactorVerifiedAt !== undefined
                ? user.strongFactorVerifiedAt
                : accessProfile.mfaVerifiedAt
        ),
        lastSuccessfulLoginAt: toIsoString(
            authenticationState.lastSuccessfulLoginAt === undefined
                ? user && user.lastSuccessfulLoginAt
                : authenticationState.lastSuccessfulLoginAt
        ),
        lastFailedLoginAt: toIsoString(
            authenticationState.lastFailedLoginAt === undefined
                ? user && user.lastFailedLoginAt
                : authenticationState.lastFailedLoginAt
        ),
        lockoutUntil,
        lockedOut: Boolean(lockoutTimestamp && Number.isFinite(referenceTimestamp) && lockoutTimestamp > referenceTimestamp),
        createdAt: toIsoString(user && user.createdAt),
        updatedAt: toIsoString(user && user.updatedAt)
    };
}

function sortPrivilegedUsers(users = []) {
    return users.slice().sort((left, right) => {
        const roleComparison = String(left.missionRole || '').localeCompare(String(right.missionRole || ''));
        if (roleComparison !== 0) {
            return roleComparison;
        }

        const emailComparison = String(left.email || '').localeCompare(String(right.email || ''));
        if (emailComparison !== 0) {
            return emailComparison;
        }

        return String(left.id || '').localeCompare(String(right.id || ''));
    });
}

function buildRoleBreakdown(users = [], roles = DEFAULT_PRIVILEGED_ROLES) {
    const byMissionRole = Object.fromEntries(normalizeRoleList(roles).map((role) => [role, 0]));

    users.forEach((user) => {
        const role = String(user && user.missionRole ? user.missionRole : '');
        byMissionRole[role] = (byMissionRole[role] || 0) + 1;
    });

    return byMissionRole;
}

function buildPrivilegedAccessSummary(users = [], roles = DEFAULT_PRIVILEGED_ROLES) {
    return {
        totalPrivilegedUsers: users.length,
        byMissionRole: buildRoleBreakdown(users, roles),
        lockedOutUsers: users.filter((user) => user.lockedOut).length,
        strongFactorVerifiedUsers: users.filter((user) => Boolean(user.strongFactorVerifiedAt)).length,
        breakGlassApprovedUsers: users.filter((user) => user.breakGlassApproved).length,
        hardwareTokenRegisteredUsers: users.filter((user) => user.hardwareTokenRegistered).length,
        pkiCertificateRegisteredUsers: users.filter((user) => user.pkiCertificateRegistered).length
    };
}

function buildPrivilegedUserIndex(users = []) {
    return new Map(
        users
            .map((user) => {
                const id = String(user && user.id ? user.id : '').trim();
                if (id) {
                    return [`id:${id}`, user];
                }

                const email = String(user && user.email ? user.email : '').trim().toLowerCase();
                return email ? [`email:${email}`, user] : null;
            })
            .filter(Boolean)
    );
}

function sortStringArray(values = []) {
    return values.slice().map((value) => String(value)).sort((left, right) => left.localeCompare(right));
}

function areComparableValuesEqual(fieldName, leftValue, rightValue) {
    if (fieldName === 'assignedMissions') {
        return JSON.stringify(sortStringArray(Array.isArray(leftValue) ? leftValue : []))
            === JSON.stringify(sortStringArray(Array.isArray(rightValue) ? rightValue : []));
    }

    return leftValue === rightValue;
}

function buildPrivilegedUserDiff(previousUser, currentUser) {
    const comparableFields = [
        'email',
        'missionRole',
        'unit',
        'assignedMissions',
        'breakGlassApproved',
        'breakGlassReasonSet',
        'hardwareTokenRegistered',
        'pkiCertificateRegistered',
        'strongFactorVerifiedAt',
        'lockedOut'
    ];
    const changedFields = [];
    const before = {};
    const after = {};

    comparableFields.forEach((fieldName) => {
        const previousValue = previousUser ? previousUser[fieldName] : undefined;
        const currentValue = currentUser ? currentUser[fieldName] : undefined;

        if (!areComparableValuesEqual(fieldName, previousValue, currentValue)) {
            changedFields.push(fieldName);
            before[fieldName] = Array.isArray(previousValue) ? previousValue.slice() : previousValue;
            after[fieldName] = Array.isArray(currentValue) ? currentValue.slice() : currentValue;
        }
    });

    return {
        changedFields,
        before,
        after
    };
}

function summarizePrivilegedUsers(users = []) {
    return sortPrivilegedUsers(users).map((user) => ({
        id: user.id,
        email: user.email,
        missionRole: user.missionRole,
        unit: user.unit,
        lockedOut: user.lockedOut
    }));
}

function buildPrivilegedAccessComparison({
    previousReport = null,
    currentUsers = [],
    roles = DEFAULT_PRIVILEGED_ROLES,
    generatedAt = new Date()
} = {}) {
    if (!previousReport || typeof previousReport !== 'object') {
        return {
            available: false,
            reason: 'No previous privileged-access report was provided.',
            previousGeneratedAt: null,
            summary: null,
            byMissionRole: null,
            addedUsers: [],
            removedUsers: [],
            changedUsers: []
        };
    }

    const normalizedRoles = normalizeRoleList(roles);
    const normalizedPreviousUsers = sortPrivilegedUsers(
        (Array.isArray(previousReport.users) ? previousReport.users : [])
            .map((user) => normalizePrivilegedUser(user, { referenceTime: generatedAt }))
    );
    const previousUsersByKey = buildPrivilegedUserIndex(normalizedPreviousUsers);
    const currentUsersByKey = buildPrivilegedUserIndex(currentUsers);
    const addedUsers = [];
    const removedUsers = [];
    const changedUsers = [];
    let unchangedUsers = 0;

    currentUsersByKey.forEach((currentUser, key) => {
        const previousUser = previousUsersByKey.get(key);

        if (!previousUser) {
            addedUsers.push(currentUser);
            return;
        }

        const diff = buildPrivilegedUserDiff(previousUser, currentUser);
        if (!diff.changedFields.length) {
            unchangedUsers += 1;
            return;
        }

        changedUsers.push({
            id: currentUser.id || previousUser.id,
            email: currentUser.email || previousUser.email,
            changedFields: diff.changedFields,
            before: diff.before,
            after: diff.after
        });
    });

    previousUsersByKey.forEach((previousUser, key) => {
        if (!currentUsersByKey.has(key)) {
            removedUsers.push(previousUser);
        }
    });

    const previousRoleBreakdown = buildRoleBreakdown(normalizedPreviousUsers, normalizedRoles);
    const currentRoleBreakdown = buildRoleBreakdown(currentUsers, normalizedRoles);
    const byMissionRole = Object.fromEntries(
        Array.from(new Set([
            ...Object.keys(previousRoleBreakdown),
            ...Object.keys(currentRoleBreakdown)
        ])).sort((left, right) => left.localeCompare(right)).map((role) => {
            const previousCount = previousRoleBreakdown[role] || 0;
            const currentCount = currentRoleBreakdown[role] || 0;

            return [role, {
                previous: previousCount,
                current: currentCount,
                delta: currentCount - previousCount
            }];
        })
    );

    return {
        available: true,
        reason: '',
        previousGeneratedAt: toIsoString(previousReport.generatedAt),
        previousCriteria: previousReport.criteria && typeof previousReport.criteria === 'object'
            ? previousReport.criteria
            : null,
        summary: {
            previousTotalPrivilegedUsers: normalizedPreviousUsers.length,
            currentTotalPrivilegedUsers: currentUsers.length,
            addedUsers: addedUsers.length,
            removedUsers: removedUsers.length,
            changedUsers: changedUsers.length,
            unchangedUsers
        },
        byMissionRole,
        addedUsers: summarizePrivilegedUsers(addedUsers),
        removedUsers: summarizePrivilegedUsers(removedUsers),
        changedUsers: changedUsers.sort((left, right) => String(left.email || left.id || '').localeCompare(String(right.email || right.id || '')))
    };
}

function loadPreviousPrivilegedAccessReport(previousReportFile = '') {
    if (!String(previousReportFile || '').trim()) {
        return null;
    }

    const absolutePath = path.resolve(process.cwd(), previousReportFile);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Previous privileged-access report not found: ${absolutePath}`);
    }

    try {
        return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    } catch (error) {
        throw new Error(`Unable to parse previous privileged-access report at ${absolutePath}: ${error.message}`);
    }
}

function buildPrivilegedAccessReport(users = [], {
    roles = DEFAULT_PRIVILEGED_ROLES,
    generatedAt = new Date(),
    previousReport = null
} = {}) {
    const normalizedRoles = normalizeRoleList(roles);
    const normalizedUsers = sortPrivilegedUsers(
        users.map((user) => normalizePrivilegedUser(user, { referenceTime: generatedAt }))
    );

    return {
        generatedAt: toIsoString(generatedAt),
        criteria: {
            missionRoles: normalizedRoles
        },
        summary: buildPrivilegedAccessSummary(normalizedUsers, normalizedRoles),
        comparison: buildPrivilegedAccessComparison({
            previousReport,
            currentUsers: normalizedUsers,
            roles: normalizedRoles,
            generatedAt
        }),
        users: normalizedUsers
    };
}

function createPrivilegedAccessQuery(UserModel, roles = DEFAULT_PRIVILEGED_ROLES) {
    return UserModel.find({
        'accessProfile.missionRole': {
            $in: normalizeRoleList(roles)
        }
    })
        .select(PRIVILEGED_USER_PROJECTION)
        .sort({
            'accessProfile.missionRole': 1,
            email: 1,
            _id: 1
        });
}

async function fetchPrivilegedUsers({
    UserModel,
    roles = DEFAULT_PRIVILEGED_ROLES
} = {}) {
    if (!UserModel || typeof UserModel.find !== 'function') {
        throw new Error('A valid User model is required to export privileged-access data.');
    }

    const query = createPrivilegedAccessQuery(UserModel, roles);
    return typeof query.lean === 'function'
        ? query.lean()
        : query;
}

function writePrivilegedAccessReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function exportPrivilegedAccessReport({
    UserModel,
    roles = DEFAULT_PRIVILEGED_ROLES,
    generatedAt = new Date(),
    previousReport = null,
    previousReportFile = '',
    outputFile = ''
} = {}) {
    const users = await fetchPrivilegedUsers({ UserModel, roles });
    const resolvedPreviousReport = previousReport || loadPreviousPrivilegedAccessReport(previousReportFile);
    const report = buildPrivilegedAccessReport(users, {
        roles,
        generatedAt,
        previousReport: resolvedPreviousReport
    });

    if (outputFile) {
        writePrivilegedAccessReport(outputFile, report);
    }

    return report;
}

function validateRuntimeRequirements(env = process.env) {
    const missing = [];

    if (!String(env.MONGODB_URI || '').trim()) {
        missing.push('MONGODB_URI');
    }

    if (!String(env.NOTE_ENCRYPTION_KEY || '').trim()) {
        missing.push('NOTE_ENCRYPTION_KEY');
    }

    if (missing.length) {
        throw new Error(`Missing required environment values for privileged-access export: ${missing.join(', ')}`);
    }
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });
    const options = parseArgs(process.argv.slice(2));

    validateRuntimeRequirements();

    const User = require('../src/models/User');
    let connected = false;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        connected = true;

        const report = await exportPrivilegedAccessReport({
            UserModel: User,
            roles: options.roles,
            previousReportFile: options.previousReportFile,
            outputFile: options.outputFile
        });

        if (options.outputFile) {
            const absolutePath = path.resolve(process.cwd(), options.outputFile);
            console.log(`Wrote privileged-access report to ${path.relative(process.cwd(), absolutePath) || absolutePath}`);
        } else {
            console.log(JSON.stringify(report, null, 2));
        }
    } finally {
        if (connected) {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Privileged-access export failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_PRIVILEGED_ROLES,
    PRIVILEGED_USER_PROJECTION,
    buildPrivilegedAccessComparison,
    buildPrivilegedAccessReport,
    buildPrivilegedAccessSummary,
    createPrivilegedAccessQuery,
    exportPrivilegedAccessReport,
    fetchPrivilegedUsers,
    loadPreviousPrivilegedAccessReport,
    normalizePrivilegedUser,
    normalizeRoleList,
    parseArgs,
    validateRuntimeRequirements,
    writePrivilegedAccessReport
};
