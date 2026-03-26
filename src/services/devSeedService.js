const crypto = require('crypto');

const FIXED_MFA_VERIFIED_AT = new Date('2026-03-25T12:00:00.000Z');

const DEV_SEED_ACCOUNT_BLUEPRINTS = [
    {
        label: 'Analyst User',
        email: 'test@example.com',
        name: 'Analyst User',
        accessProfile: {
            missionRole: 'analyst',
            clearance: 'protected_b',
            unit: 'cyber-task-force',
            assignedMissions: ['research-workspace', 'browser-assurance'],
            deviceTier: 'managed',
            networkZones: ['corp'],
            mfaVerifiedAt: null,
            breakGlassApproved: false,
            breakGlassReason: ''
        },
        noteOwner: true
    },
    {
        label: 'Deployed Operator',
        email: 'operator@example.com',
        name: 'Deployed Operator',
        accessProfile: {
            missionRole: 'operator',
            clearance: 'protected_b',
            unit: 'forward-detachment',
            assignedMissions: ['research-workspace'],
            deviceTier: 'managed',
            networkZones: ['mission'],
            mfaVerifiedAt: null,
            breakGlassApproved: false,
            breakGlassReason: ''
        }
    },
    {
        label: 'Mission Lead',
        email: 'missionlead@example.com',
        name: 'Mission Lead',
        accessProfile: {
            missionRole: 'mission_lead',
            clearance: 'secret',
            unit: 'cyber-task-force',
            assignedMissions: ['research-workspace', 'incident-response'],
            deviceTier: 'hardened',
            networkZones: ['corp', 'mission'],
            mfaVerifiedAt: FIXED_MFA_VERIFIED_AT,
            breakGlassApproved: false,
            breakGlassReason: ''
        }
    },
    {
        label: 'Auditor',
        email: 'auditor@example.com',
        name: 'Auditor',
        accessProfile: {
            missionRole: 'auditor',
            clearance: 'secret',
            unit: 'oversight-cell',
            assignedMissions: ['research-workspace', 'incident-response'],
            deviceTier: 'managed',
            networkZones: ['corp'],
            mfaVerifiedAt: FIXED_MFA_VERIFIED_AT,
            breakGlassApproved: false,
            breakGlassReason: ''
        }
    },
    {
        label: 'Policy Admin',
        email: 'admin@example.com',
        name: 'Policy Admin',
        accessProfile: {
            missionRole: 'admin',
            clearance: 'top_secret',
            unit: 'cyber-governance',
            assignedMissions: ['research-workspace', 'incident-response', 'cyber-governance'],
            deviceTier: 'hardened',
            networkZones: ['corp'],
            mfaVerifiedAt: FIXED_MFA_VERIFIED_AT,
            breakGlassApproved: false,
            breakGlassReason: ''
        }
    },
    {
        label: 'Break-Glass Lead',
        email: 'breakglass@example.com',
        name: 'Break-Glass Lead',
        accessProfile: {
            missionRole: 'break_glass',
            clearance: 'secret',
            unit: 'cyber-task-force',
            assignedMissions: ['research-workspace', 'incident-response'],
            deviceTier: 'hardened',
            networkZones: ['corp', 'mission'],
            mfaVerifiedAt: FIXED_MFA_VERIFIED_AT,
            breakGlassApproved: true,
            breakGlassReason: 'Emergency containment authority during active incident response.'
        }
    }
];

const DEFAULT_ANALYST_NOTES = [
    {
        title: 'Meeting Notes',
        content: 'Discussed Q1 goals and upcoming project deadlines. Action items: Review budget, Schedule team meeting.',
        image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600'
    },
    {
        title: 'Shopping List',
        content: 'Milk, Eggs, Bread, Butter, Coffee, Fresh vegetables',
        image: ''
    },
    {
        title: 'Book Ideas',
        content: 'Research topics for new project: Machine Learning basics, Web Development trends, Design patterns',
        image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600'
    }
];

function cloneAccountBlueprint(account) {
    return {
        ...account,
        accessProfile: {
            ...account.accessProfile,
            assignedMissions: [...account.accessProfile.assignedMissions],
            networkZones: [...account.accessProfile.networkZones],
            mfaVerifiedAt: account.accessProfile.mfaVerifiedAt
                ? new Date(account.accessProfile.mfaVerifiedAt)
                : null
        }
    };
}

function listDevSeedAccounts() {
    return DEV_SEED_ACCOUNT_BLUEPRINTS.map((account) => {
        const cloned = cloneAccountBlueprint(account);

        return {
            label: cloned.label,
            email: cloned.email,
            missionRole: cloned.accessProfile.missionRole,
            clearance: cloned.accessProfile.clearance,
            unit: cloned.accessProfile.unit,
            assignedMissions: [...cloned.accessProfile.assignedMissions],
            networkZones: [...cloned.accessProfile.networkZones],
            breakGlassApproved: cloned.accessProfile.breakGlassApproved
        };
    });
}

function buildSeedResponseMessage(summary) {
    const lines = [
        'Database seeded with development accounts.',
        'Your previous session user may have been deleted; log in again with one of the accounts below.',
        ''
    ];

    summary.accounts.forEach((account) => {
        lines.push(`- ${account.label}: ${account.email} / ${summary.password} (${account.missionRole}, ${account.clearance})`);
    });

    lines.push('');
    lines.push(`Sample notes created for: ${summary.notesSeededFor}`);

    return lines.join('\n');
}

async function seedDevelopmentData({ User, Notes, bcryptLib, password = '' } = {}) {
    if (!User || !Notes || !bcryptLib || typeof bcryptLib.hash !== 'function') {
        throw new Error('User, Notes, and bcryptLib.hash are required to seed development data.');
    }

    const resolvedPassword = resolveDevelopmentSeedPassword(password);

    await Notes.deleteMany({});
    await User.deleteMany({});

    const hashedPassword = await bcryptLib.hash(resolvedPassword, 10);
    const blueprints = DEV_SEED_ACCOUNT_BLUEPRINTS.map(cloneAccountBlueprint);
    const createdAccounts = [];

    for (const blueprint of blueprints) {
        const createdUser = await User.create({
            email: blueprint.email,
            name: blueprint.name,
            password: hashedPassword,
            accessProfile: blueprint.accessProfile
        });

        createdAccounts.push({
            ...blueprint,
            _id: createdUser._id
        });
    }

    const analystAccount = createdAccounts.find((account) => account.noteOwner);

    if (analystAccount) {
        await Notes.create(DEFAULT_ANALYST_NOTES.map((note) => ({
            ...note,
            user: analystAccount._id
        })));
    }

    return {
        password: resolvedPassword,
        notesSeededFor: analystAccount ? analystAccount.email : '',
        accounts: createdAccounts.map((account) => ({
            label: account.label,
            email: account.email,
            missionRole: account.accessProfile.missionRole,
            clearance: account.accessProfile.clearance,
            unit: account.accessProfile.unit,
            assignedMissions: [...account.accessProfile.assignedMissions],
            networkZones: [...account.accessProfile.networkZones],
            breakGlassApproved: account.accessProfile.breakGlassApproved
        }))
    };
}

function resolveDevelopmentSeedPassword(explicitPassword = '') {
    const candidate = String(
        explicitPassword
        || process.env.DEV_SEED_PASSWORD
        || ''
    ).trim();

    if (candidate) {
        return candidate;
    }

    return `seed-${crypto.randomBytes(9).toString('base64url')}`;
}

module.exports = {
    buildSeedResponseMessage,
    listDevSeedAccounts,
    resolveDevelopmentSeedPassword,
    seedDevelopmentData
};
