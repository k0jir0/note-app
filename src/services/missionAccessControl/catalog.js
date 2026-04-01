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
        id: 'view_injection_prevention_module',
        label: 'View Injection Prevention Module',
        description: 'Inspect the application injection-hardening posture and safe query patterns.',
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
        id: 'evaluate_injection_prevention_controls',
        label: 'Evaluate Injection Prevention Controls',
        description: 'Simulate whether a request payload should be rejected before it reaches the data layer.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'view_xss_defense_module',
        label: 'View XSS Defense Module',
        description: 'Inspect escaped rendering posture, CSP controls, and browser-facing XSS defenses.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'evaluate_xss_defense_controls',
        label: 'Evaluate XSS Defense Controls',
        description: 'Simulate whether untrusted browser content is neutralized by escaped rendering and strict CSP.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'view_access_control_module',
        label: 'View Access Control Module',
        description: 'Inspect server-side API identity coverage and the current access-control posture.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'evaluate_access_control_controls',
        label: 'Evaluate Access Control Controls',
        description: 'Simulate whether a direct API call is blocked or allowed by the server-side access-control layers.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['public', 'corp', 'mission'],
        sensitivity: 'moderate'
    },
    {
        id: 'view_break_glass_module',
        label: 'View Break-Glass Module',
        description: 'Inspect the current kill-switch state, health posture, and emergency-control workflow.',
        allowedRoles: ['operator', 'analyst', 'mission_lead', 'auditor', 'admin', 'break_glass'],
        requiresMfa: false,
        requiredMfaMethod: 'none',
        breakGlassEligible: true,
        allowedNetworkZones: ['corp', 'mission'],
        sensitivity: 'high'
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
        id: 'injection-prevention-lab',
        title: 'Injection Prevention Lab',
        summary: 'A research surface for structured query builders, operator-key blocking, and Mongoose filter hardening.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_injection_prevention_module', 'evaluate_injection_prevention_controls'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['public', 'corp', 'mission'],
        requiresMfa: false,
        requiredMfaMethod: 'none'
    },
    {
        id: 'xss-defense-lab',
        title: 'XSS Defense Lab',
        summary: 'A research surface for escaped rendering, sink discipline, and strict Content Security Policy controls.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_xss_defense_module', 'evaluate_xss_defense_controls'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['public', 'corp', 'mission'],
        requiresMfa: false,
        requiredMfaMethod: 'none'
    },
    {
        id: 'access-control-lab',
        title: 'Access Control Lab',
        summary: 'A research surface for protected-by-default API coverage, ownership scoping, and server-side access decisions.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_access_control_module', 'evaluate_access_control_controls'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['public', 'corp', 'mission'],
        requiresMfa: false,
        requiredMfaMethod: 'none'
    },
    {
        id: 'break-glass-control-center',
        title: 'Break-Glass Control Center',
        summary: 'A research surface for read-only failover, emergency shutdown posture, and kill-switch governance.',
        classification: 'protected_b',
        missionId: 'research-workspace',
        allowedActions: ['view_break_glass_module'],
        allowedUnits: [],
        requiredDeviceTier: 'managed',
        allowedNetworkZones: ['corp', 'mission'],
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
    { actionId: 'evaluate_injection_prevention_controls', resourceId: 'injection-prevention-lab' },
    { actionId: 'evaluate_xss_defense_controls', resourceId: 'xss-defense-lab' },
    { actionId: 'evaluate_access_control_controls', resourceId: 'access-control-lab' },
    { actionId: 'evaluate_session_lockdown_controls', resourceId: 'session-management-lab' },
    { actionId: 'train_ml_model', resourceId: 'triage-model-training' },
    { actionId: 'export_incident_report', resourceId: 'incident-report-export' },
    { actionId: 'approve_block_action', resourceId: 'autonomy-block-policy' },
    { actionId: 'administer_policy', resourceId: 'policy-admin-console' }
];

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

module.exports = {
    ACTION_CATALOG,
    CLEARANCE_LEVELS,
    DEFAULT_USER_PROFILE,
    DEVICE_TIERS,
    MATRIX_COMBINATIONS,
    MISSION_ROLES,
    NETWORK_ZONES,
    POLICY_PRINCIPLES,
    RECOMMENDED_CONTROLS,
    RESOURCE_CATALOG,
    SAMPLE_PERSONAS,
    getMissionAction,
    getMissionPersona,
    getMissionResource,
    listMissionActions,
    listMissionPersonas,
    listMissionResources
};
