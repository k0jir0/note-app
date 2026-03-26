const {
    isHardwareFirstMfaMethod,
    normalizeMfaMethod,
    normalizeRegisteredAuthenticators
} = require('./hardwareFirstMfaService');

const MISSION_ROLES = [
    'operator',
    'analyst',
    'mission_lead',
    'auditor',
    'admin',
    'break_glass'
];

const CLEARANCE_LEVELS = [
    'unclassified',
    'protected_a',
    'protected_b',
    'secret',
    'top_secret'
];

const DEVICE_TIERS = [
    'unknown',
    'managed',
    'hardened'
];

const NETWORK_ZONES = [
    'public',
    'corp',
    'mission'
];

const DEFAULT_ASSIGNED_MISSIONS = [
    'research-workspace',
    'browser-assurance'
];

const DEFAULT_USER_PROFILE = {
    missionRole: 'analyst',
    clearance: 'protected_b',
    unit: 'cyber-task-force',
    assignedMissions: DEFAULT_ASSIGNED_MISSIONS,
    deviceTier: 'managed',
    networkZones: ['corp'],
    mfaVerified: false,
    mfaMethod: 'none',
    mfaAssurance: 'password_only',
    mfaHardwareFirst: false,
    registeredHardwareToken: false,
    hardwareTokenLabel: '',
    hardwareTokenSerial: '',
    registeredPkiCertificate: false,
    pkiCertificateSubject: '',
    pkiCertificateIssuer: '',
    breakGlassApproved: false,
    breakGlassReason: ''
};

const ACTION_CATALOG = [
    {
        id: 'view_mission_assurance_module',
        label: 'View Mission Assurance Module',
        description: 'Inspect the policy surface, controls, and current-user security context.',
        allowedRoles: ['analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'evaluate_policy_decisions',
        label: 'Evaluate Policy Decisions',
        description: 'Simulate a tactical authorization decision before a sensitive workflow is exposed.',
        allowedRoles: ['analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'view_security_alerts',
        label: 'View Security Alerts',
        description: 'Review the live alert feed for a mission-aligned workspace.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'train_ml_model',
        label: 'Train ML Model',
        description: 'Launch or approve a new alert-triage model build.',
        allowedRoles: ['mission_lead', 'admin', 'break_glass'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'high'
    },
    {
        id: 'export_incident_report',
        label: 'Export Incident Report',
        description: 'Export an incident summary that may contain sensitive operational data.',
        allowedRoles: ['mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'high'
    },
    {
        id: 'approve_block_action',
        label: 'Approve Block Action',
        description: 'Authorize a block or containment action against a mission-relevant target.',
        allowedRoles: ['mission_lead', 'admin', 'break_glass'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first',
        breakGlassEligible: true,
        allowedNetworkZones: ['mission'],
        sensitivity: 'critical'
    },
    {
        id: 'administer_policy',
        label: 'Administer Policy',
        description: 'Change access-control policy definitions or override rules.',
        allowedRoles: ['admin', 'break_glass'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first',
        breakGlassEligible: false,
        allowedNetworkZones: ['corp'],
        sensitivity: 'critical'
    },
    {
        id: 'view_hardware_mfa_module',
        label: 'View Hardware-First MFA Module',
        description: 'Inspect registered strong factors, session assurance state, and hardware-first MFA guidance.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'view_session_management_module',
        label: 'View Session Management Module',
        description: 'Inspect strict timeout policy, current session state, and concurrent-login controls.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'evaluate_session_lockdown_controls',
        label: 'Evaluate Session Lockdown Controls',
        description: 'Simulate whether an abandoned or superseded session should be locked immediately.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'perform_hardware_mfa_step_up',
        label: 'Perform Hardware-First Step-Up',
        description: 'Request and verify a hardware-token or PKI-backed step-up challenge.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'moderate'
    }
];

const RESOURCE_CATALOG = [
    {
        id: 'mission-assurance-lab',
        title: 'Mission Assurance Policy Lab',
        summary: 'The research surface where policy decisions are simulated before they gate a hardened workflow.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_mission_assurance_module', 'evaluate_policy_decisions'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
        requiresMfa: false
    },
    {
        id: 'security-alert-feed',
        title: 'Security Alert Feed',
        summary: 'Live and saved security alerts collected for the active mission workspace.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_security_alerts'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
        requiresMfa: false
    },
    {
        id: 'hardware-mfa-lab',
        title: 'Hardware-First MFA Lab',
        summary: 'A research surface for hardware-token and PKI-backed step-up assurance.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_hardware_mfa_module', 'perform_hardware_mfa_step_up'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
        requiresMfa: false,
        requiredMfaMethod: 'none'
    },
    {
        id: 'session-management-lab',
        title: 'Session Management Lab',
        summary: 'A research surface for strict timeout, terminal lock, and concurrent-login enforcement.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_session_management_module', 'evaluate_session_lockdown_controls'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['public', 'corp', 'mission'],
        requiresMfa: false,
        requiredMfaMethod: 'none'
    },
    {
        id: 'triage-model-training',
        title: 'Alert Triage Model Training',
        summary: 'The model-training surface that can change how future alerts are prioritized.',
        classification: 'secret',
        missionId: 'research-workspace',
        allowedActions: ['train_ml_model'],
        allowedUnits: ['cyber-task-force', 'model-ops'],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first'
    },
    {
        id: 'incident-report-export',
        title: 'Incident Report Export',
        summary: 'A packaged incident report that can be shared outside the immediate response cell.',
        classification: 'protected_b',
        missionId: 'incident-response',
        allowedActions: ['export_incident_report'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first'
    },
    {
        id: 'autonomy-block-policy',
        title: 'Autonomous Block Approval',
        summary: 'The decision surface that approves or denies an autonomous block action.',
        classification: 'secret',
        missionId: 'incident-response',
        allowedActions: ['approve_block_action'],
        allowedUnits: ['cyber-task-force'],
        requiredDeviceTier: 'hardened',
        allowedNetworkZones: ['mission'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first'
    },
    {
        id: 'policy-admin-console',
        title: 'Policy Administration Console',
        summary: 'The highest-trust surface for changing policy baselines and override rules.',
        classification: 'top_secret',
        missionId: 'cyber-governance',
        allowedActions: ['administer_policy'],
        allowedUnits: ['cyber-governance'],
        requiredDeviceTier: 'hardened',
        allowedNetworkZones: ['corp'],
        requiresMfa: true,
        requiredMfaMethod: 'hardware_first'
    }
];

const POLICY_PRINCIPLES = [
    {
        id: 'least-privilege',
        label: 'Least Privilege',
        description: 'Every action is denied by default unless the user role and mission context both justify it.'
    },
    {
        id: 'rbac-baseline',
        label: 'RBAC Baseline',
        description: 'Mission role establishes the baseline set of actions a user may attempt.'
    },
    {
        id: 'abac-context',
        label: 'ABAC Context',
        description: 'Clearance, mission assignment, unit, device trust, network zone, and MFA state refine the final allow or deny decision.'
    },
    {
        id: 'step-up-auth',
        label: 'Step-Up Authentication',
        description: 'Sensitive actions require fresh hardware-token or PKI-backed MFA evidence before the policy engine will allow them.'
    },
    {
        id: 'audited-exceptions',
        label: 'Audited Exceptions',
        description: 'Break-glass access is explicit, justified, time-bound, and never silent.'
    }
];

const RECOMMENDED_CONTROLS = [
    {
        id: 'server-side-enforcement',
        label: 'Server-side enforcement',
        description: 'Hide buttons in the UI if you want, but always gate the underlying route or job server-side.'
    },
    {
        id: 'field-level-controls',
        label: 'Field-level restrictions',
        description: 'A user may be cleared to view a record summary but not every field inside that record.'
    },
    {
        id: 'jit-elevation',
        label: 'Just-in-time elevation',
        description: 'High-trust actions should require temporary elevation rather than long-lived standing privilege.'
    },
    {
        id: 'hardware-first-mfa',
        label: 'Hardware-first MFA',
        description: 'Prefer hardware tokens or PKI-backed client certificates over weaker software-only second factors.'
    },
    {
        id: 'immutable-audit',
        label: 'Immutable audit trail',
        description: 'Record who accessed what, when, under which rule, from which network zone, and with which MFA state.'
    }
];

const SAMPLE_PERSONAS = [
    {
        id: 'deployed-operator',
        label: 'Deployed Operator',
        summary: 'A field operator on a managed device who can view mission data but cannot approve strategic changes.',
        missionRole: 'operator',
        clearance: 'protected_b',
        unit: 'forward-detachment',
        assignedMissions: ['research-workspace'],
        deviceTier: 'managed',
        networkZones: ['mission'],
        registeredHardwareToken: true,
        hardwareTokenLabel: 'FieldKey Alpha',
        hardwareTokenSerial: 'CAF-OP-1001',
        mfaVerified: false,
        mfaMethod: 'none',
        mfaHardwareFirst: false,
        breakGlassApproved: false
    },
    {
        id: 'cyber-analyst',
        label: 'Cyber Analyst',
        summary: 'An analyst with enough clearance to investigate incidents and simulate policy decisions.',
        missionRole: 'analyst',
        clearance: 'secret',
        unit: 'cyber-task-force',
        assignedMissions: ['research-workspace', 'incident-response'],
        deviceTier: 'managed',
        networkZones: ['corp'],
        registeredPkiCertificate: true,
        pkiCertificateSubject: 'CN=cyber-analyst, OU=CAF Research',
        pkiCertificateIssuer: 'CN=CAF Root CA',
        mfaVerified: true,
        mfaMethod: 'pki_certificate',
        mfaHardwareFirst: true,
        breakGlassApproved: false
    },
    {
        id: 'mission-lead',
        label: 'Mission Lead',
        summary: 'A mission lead on a hardened device who can approve high-impact operational actions.',
        missionRole: 'mission_lead',
        clearance: 'secret',
        unit: 'cyber-task-force',
        assignedMissions: ['research-workspace', 'incident-response'],
        deviceTier: 'hardened',
        networkZones: ['corp', 'mission'],
        registeredHardwareToken: true,
        hardwareTokenLabel: 'MissionLeadKey',
        hardwareTokenSerial: 'CAF-ML-2001',
        mfaVerified: true,
        mfaMethod: 'hardware_token',
        mfaHardwareFirst: true,
        breakGlassApproved: false
    },
    {
        id: 'auditor',
        label: 'Auditor',
        summary: 'An oversight persona that can inspect and export evidence but not modify mission policy.',
        missionRole: 'auditor',
        clearance: 'secret',
        unit: 'oversight-cell',
        assignedMissions: ['incident-response'],
        deviceTier: 'managed',
        networkZones: ['corp'],
        registeredPkiCertificate: true,
        pkiCertificateSubject: 'CN=auditor, OU=CAF Oversight',
        pkiCertificateIssuer: 'CN=CAF Root CA',
        mfaVerified: true,
        mfaMethod: 'pki_certificate',
        mfaHardwareFirst: true,
        breakGlassApproved: false
    },
    {
        id: 'break-glass-lead',
        label: 'Break-Glass Lead',
        summary: 'A lead in an emergency window with an approved justification recorded for temporary elevated access.',
        missionRole: 'break_glass',
        clearance: 'secret',
        unit: 'cyber-task-force',
        assignedMissions: ['research-workspace'],
        deviceTier: 'hardened',
        networkZones: ['corp', 'mission'],
        registeredHardwareToken: true,
        hardwareTokenLabel: 'BreakGlassKey',
        hardwareTokenSerial: 'CAF-BG-9999',
        registeredPkiCertificate: true,
        pkiCertificateSubject: 'CN=break-glass-lead, OU=CAF Emergency',
        pkiCertificateIssuer: 'CN=CAF Root CA',
        mfaVerified: true,
        mfaMethod: 'hardware_token',
        mfaHardwareFirst: true,
        breakGlassApproved: true,
        breakGlassReason: 'Emergency containment authority during active incident response.'
    }
];

const MATRIX_COMBINATIONS = [
    { actionId: 'view_security_alerts', resourceId: 'security-alert-feed' },
    { actionId: 'evaluate_session_lockdown_controls', resourceId: 'session-management-lab' },
    { actionId: 'train_ml_model', resourceId: 'triage-model-training' },
    { actionId: 'export_incident_report', resourceId: 'incident-report-export' },
    { actionId: 'approve_block_action', resourceId: 'autonomy-block-policy' },
    { actionId: 'administer_policy', resourceId: 'policy-admin-console' }
];

function rankOf(list, value, fallbackIndex = 0) {
    const index = list.indexOf(value);
    return index === -1 ? fallbackIndex : index;
}

function isValidMissionRole(value) {
    return MISSION_ROLES.includes(String(value || '').trim().toLowerCase());
}

function isValidClearance(value) {
    return CLEARANCE_LEVELS.includes(String(value || '').trim().toLowerCase());
}

function isValidDeviceTier(value) {
    return DEVICE_TIERS.includes(String(value || '').trim().toLowerCase());
}

function isValidNetworkZone(value) {
    return NETWORK_ZONES.includes(String(value || '').trim().toLowerCase());
}

function normalizeMissionList(items, fallback = DEFAULT_ASSIGNED_MISSIONS) {
    const values = Array.isArray(items)
        ? items
        : (typeof items === 'string' && items.trim()
            ? items.split(',')
            : []);

    const normalized = Array.from(new Set(values
        .map((value) => String(value || '').trim())
        .filter(Boolean)));

    return normalized.length ? normalized : [...fallback];
}

function normalizeNetworkZoneList(items, fallback = ['corp']) {
    const values = Array.isArray(items)
        ? items
        : (typeof items === 'string' && items.trim()
            ? items.split(',')
            : []);

    const normalized = Array.from(new Set(values
        .map((value) => String(value || '').trim().toLowerCase())
        .filter((value) => isValidNetworkZone(value))));

    return normalized.length ? normalized : [...fallback];
}

function normalizeUserAccessProfile(user = {}) {
    const source = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : user;
    const registeredAuthenticators = normalizeRegisteredAuthenticators(user);

    const missionRole = String(source.missionRole || DEFAULT_USER_PROFILE.missionRole).trim().toLowerCase();
    const clearance = String(source.clearance || DEFAULT_USER_PROFILE.clearance).trim().toLowerCase();
    const deviceTier = String(source.deviceTier || DEFAULT_USER_PROFILE.deviceTier).trim().toLowerCase();
    const normalizedMfaMethod = normalizeMfaMethod(source.mfaMethod || DEFAULT_USER_PROFILE.mfaMethod);
    const mfaHardwareFirst = Boolean(source.mfaHardwareFirst || isHardwareFirstMfaMethod(normalizedMfaMethod));
    const normalized = {
        id: user && user._id ? String(user._id) : '',
        displayName: String(source.displayName || user.name || user.email || 'Current user'),
        email: String(user.email || ''),
        missionRole: isValidMissionRole(missionRole) ? missionRole : DEFAULT_USER_PROFILE.missionRole,
        clearance: isValidClearance(clearance) ? clearance : DEFAULT_USER_PROFILE.clearance,
        unit: String(source.unit || DEFAULT_USER_PROFILE.unit).trim() || DEFAULT_USER_PROFILE.unit,
        assignedMissions: normalizeMissionList(source.assignedMissions, DEFAULT_USER_PROFILE.assignedMissions),
        deviceTier: isValidDeviceTier(deviceTier) ? deviceTier : DEFAULT_USER_PROFILE.deviceTier,
        networkZones: normalizeNetworkZoneList(source.networkZones, DEFAULT_USER_PROFILE.networkZones),
        mfaVerified: Boolean(source.mfaVerified || source.mfaVerifiedAt),
        mfaMethod: normalizedMfaMethod,
        mfaAssurance: mfaHardwareFirst ? 'hardware_first' : 'password_only',
        mfaHardwareFirst,
        registeredAuthenticators,
        breakGlassApproved: Boolean(source.breakGlassApproved),
        breakGlassReason: String(source.breakGlassReason || '').trim()
    };

    return normalized;
}

function listMissionActions() {
    return ACTION_CATALOG.map((action) => ({
        ...action,
        allowedRoles: [...action.allowedRoles],
        allowedNetworkZones: [...action.allowedNetworkZones]
    }));
}

function listMissionResources() {
    return RESOURCE_CATALOG.map((resource) => ({
        ...resource,
        allowedActions: [...resource.allowedActions],
        allowedUnits: [...resource.allowedUnits],
        allowedNetworkZones: [...resource.allowedNetworkZones]
    }));
}

function listMissionPersonas() {
    return SAMPLE_PERSONAS.map((persona) => ({
        ...persona,
        assignedMissions: [...persona.assignedMissions],
        networkZones: [...persona.networkZones]
    }));
}

function getMissionAction(actionId) {
    return listMissionActions().find((action) => action.id === actionId) || null;
}

function getMissionResource(resourceId) {
    return listMissionResources().find((resource) => resource.id === resourceId) || null;
}

function getMissionPersona(personaId) {
    return listMissionPersonas().find((persona) => persona.id === personaId) || null;
}

function buildEvaluationContext(subject, contextOverrides = {}) {
    const requestedNetworkZone = String(contextOverrides.networkZone || '').trim().toLowerCase();
    const requestedDeviceTier = String(contextOverrides.deviceTier || '').trim().toLowerCase();

    return {
        networkZone: isValidNetworkZone(requestedNetworkZone)
            ? requestedNetworkZone
            : (subject.networkZones[0] || 'corp'),
        deviceTier: isValidDeviceTier(requestedDeviceTier)
            ? requestedDeviceTier
            : subject.deviceTier,
        currentTime: contextOverrides.currentTime || new Date().toISOString(),
        justification: String(contextOverrides.justification || '').trim()
    };
}

function buildCheck(id, label, passed, detail, failedDetail, severity = 'gate') {
    return {
        id,
        label,
        passed: !!passed,
        severity,
        detail: passed ? detail : failedDetail
    };
}

function evaluateMissionAccess({ user, subject, actionId, resourceId, contextOverrides = {} } = {}) {
    const resolvedAction = getMissionAction(actionId);
    const resolvedResource = getMissionResource(resourceId);

    if (!resolvedAction) {
        const error = new Error(`Unknown mission access action: ${actionId}`);
        error.code = 'UNKNOWN_ACTION';
        throw error;
    }

    if (!resolvedResource) {
        const error = new Error(`Unknown mission access resource: ${resourceId}`);
        error.code = 'UNKNOWN_RESOURCE';
        throw error;
    }

    const resolvedSubject = normalizeUserAccessProfile(subject || user);
    const context = buildEvaluationContext(resolvedSubject, contextOverrides);
    const breakGlassActive = resolvedSubject.breakGlassApproved
        && Boolean((resolvedSubject.breakGlassReason || context.justification).trim());
    const requiredMfaMethod = String(resolvedAction.requiredMfaMethod || resolvedResource.requiredMfaMethod || 'none').trim().toLowerCase();

    const checks = [];

    const roleAllowed = resolvedAction.allowedRoles.includes(resolvedSubject.missionRole)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'role',
        'Role baseline',
        roleAllowed,
        `${resolvedSubject.missionRole} is permitted to attempt ${resolvedAction.label.toLowerCase()}.`,
        `${resolvedSubject.missionRole} is not an approved role for ${resolvedAction.label.toLowerCase()}.`
    ));

    const actionAllowedForResource = resolvedResource.allowedActions.includes(resolvedAction.id);
    checks.push(buildCheck(
        'resource-action',
        'Action matches resource',
        actionAllowedForResource,
        `${resolvedAction.label} is a valid action for ${resolvedResource.title}.`,
        `${resolvedAction.label} is not exposed for ${resolvedResource.title}.`
    ));

    const clearancePass = rankOf(CLEARANCE_LEVELS, resolvedSubject.clearance) >= rankOf(CLEARANCE_LEVELS, resolvedResource.classification);
    checks.push(buildCheck(
        'clearance',
        'Security clearance',
        clearancePass,
        `${resolvedSubject.clearance} meets or exceeds ${resolvedResource.classification}.`,
        `${resolvedSubject.clearance} does not meet the ${resolvedResource.classification} classification requirement.`
    ));

    const missionPass = resolvedSubject.assignedMissions.includes(resolvedResource.missionId)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'mission',
        'Mission assignment',
        missionPass,
        `${resolvedSubject.displayName} is assigned to ${resolvedResource.missionId}.`,
        `${resolvedSubject.displayName} is not assigned to ${resolvedResource.missionId}.`
    ));

    const unitPass = !resolvedResource.allowedUnits.length
        || resolvedResource.allowedUnits.includes(resolvedSubject.unit)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'unit',
        'Unit restriction',
        unitPass,
        resolvedResource.allowedUnits.length
            ? `${resolvedSubject.unit} is in the allowed unit list.`
            : 'No unit restriction is applied to this resource.',
        `${resolvedSubject.unit} is not permitted for this resource.`
    ));

    const devicePass = rankOf(DEVICE_TIERS, context.deviceTier) >= rankOf(DEVICE_TIERS, resolvedResource.requiredDeviceTier);
    checks.push(buildCheck(
        'device',
        'Device trust',
        devicePass,
        `${context.deviceTier} device trust satisfies the ${resolvedResource.requiredDeviceTier} requirement.`,
        `${context.deviceTier} device trust does not satisfy the ${resolvedResource.requiredDeviceTier} requirement.`
    ));

    const zonePass = resolvedAction.allowedNetworkZones.includes(context.networkZone)
        && resolvedResource.allowedNetworkZones.includes(context.networkZone);
    checks.push(buildCheck(
        'network',
        'Network zone',
        zonePass,
        `${context.networkZone} is an approved network zone for this action and resource.`,
        `${context.networkZone} is not an approved network zone for this action and resource.`
    ));

    const mfaRequired = resolvedAction.requiresMfa || resolvedResource.requiresMfa;
    const hardwareFirstRequired = mfaRequired && requiredMfaMethod === 'hardware_first';
    const mfaPass = !mfaRequired || (
        resolvedSubject.mfaVerified
        && (!hardwareFirstRequired || resolvedSubject.mfaHardwareFirst)
    );
    const mfaSuccessDetail = hardwareFirstRequired
        ? `Hardware-first MFA is verified through ${resolvedSubject.mfaMethod === 'pki_certificate' ? 'a PKI certificate' : 'a hardware token'}.`
        : (mfaRequired
            ? 'Fresh MFA evidence is present for this sensitive action.'
            : 'This action does not require step-up MFA.');
    const mfaFailureDetail = hardwareFirstRequired
        ? 'A verified hardware token or PKI certificate is required before this action can proceed.'
        : (mfaRequired
            ? 'Fresh MFA evidence is required before this action can proceed.'
            : 'This action does not require step-up MFA.');
    checks.push(buildCheck(
        'mfa',
        'Step-up authentication',
        mfaPass,
        mfaSuccessDetail,
        mfaFailureDetail
    ));

    const justificationPass = !breakGlassActive || Boolean((context.justification || resolvedSubject.breakGlassReason).trim());
    checks.push(buildCheck(
        'justification',
        'Break-glass justification',
        justificationPass,
        breakGlassActive
            ? 'Break-glass justification is recorded.'
            : 'No break-glass override is in effect.',
        'Break-glass access requires a recorded justification.'
    ));

    const allowed = checks.every((check) => check.passed);
    const obligations = [];

    if (allowed) {
        obligations.push('Record an immutable audit event with role, clearance, network zone, and resource id.');

        if (mfaRequired) {
            obligations.push(
                hardwareFirstRequired
                    ? 'Bind the approval to the current hardware token or PKI-backed proof and expire it after the action completes.'
                    : 'Bind the approval to the current MFA proof and expire it after the action completes.'
            );
        }

        if (breakGlassActive) {
            obligations.push('Flag the decision for after-action review because break-glass access was used.');
        }

        if (resolvedAction.sensitivity === 'critical') {
            obligations.push('Require dual review or post-action commander acknowledgement for critical changes.');
        }
    }

    return {
        allowed,
        decision: allowed ? 'allow' : 'deny',
        summary: allowed
            ? `${resolvedSubject.displayName} may ${resolvedAction.label.toLowerCase()} on ${resolvedResource.title}.`
            : `${resolvedSubject.displayName} may not ${resolvedAction.label.toLowerCase()} on ${resolvedResource.title}.`,
        action: resolvedAction,
        resource: resolvedResource,
        subject: resolvedSubject,
        context,
        breakGlassActive,
        checks,
        satisfiedChecks: checks.filter((check) => check.passed),
        failedChecks: checks.filter((check) => !check.passed),
        obligations
    };
}

function buildDecisionMatrix(subject) {
    const entries = MATRIX_COMBINATIONS.map((combination) => evaluateMissionAccess({
        subject,
        actionId: combination.actionId,
        resourceId: combination.resourceId,
        contextOverrides: {
            networkZone: subject.networkZones[0] || 'corp',
            justification: subject.breakGlassReason || ''
        }
    })).map((result) => ({
        actionId: result.action.id,
        actionLabel: result.action.label,
        resourceId: result.resource.id,
        resourceTitle: result.resource.title,
        decision: result.decision,
        allowed: result.allowed,
        failedChecks: result.failedChecks.map((check) => check.label),
        summary: result.summary
    }));

    return {
        allowedCount: entries.filter((entry) => entry.allowed).length,
        deniedCount: entries.filter((entry) => !entry.allowed).length,
        entries
    };
}

function buildCurrentUserPersona(user) {
    const profile = normalizeUserAccessProfile(user);

    return {
        id: 'current-user',
        label: `${profile.displayName} (Current Session)`,
        summary: 'Use the current session identity so the module reflects the access profile that is active right now.',
        ...profile
    };
}

module.exports = {
    ACTION_CATALOG,
    CLEARANCE_LEVELS,
    DEFAULT_USER_PROFILE,
    DEVICE_TIERS,
    MISSION_ROLES,
    NETWORK_ZONES,
    POLICY_PRINCIPLES,
    RECOMMENDED_CONTROLS,
    RESOURCE_CATALOG,
    SAMPLE_PERSONAS,
    buildCurrentUserPersona,
    buildDecisionMatrix,
    evaluateMissionAccess,
    getMissionAction,
    getMissionPersona,
    getMissionResource,
    isValidNetworkZone,
    listMissionActions,
    listMissionPersonas,
    listMissionResources,
    normalizeUserAccessProfile
};
