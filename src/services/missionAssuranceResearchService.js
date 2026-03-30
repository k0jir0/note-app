const {
    POLICY_PRINCIPLES,
    RECOMMENDED_CONTROLS,
    buildCurrentUserPersona,
    buildDecisionMatrix,
    evaluateMissionAccess,
    getMissionPersona,
    listMissionActions,
    listMissionPersonas,
    listMissionResources,
    normalizeUserAccessProfile
} = require('./missionAccessControlService');

function normalizeBaseUrl(baseUrl) {
    const value = String(baseUrl || '').trim();
    return value || 'http://localhost:3000';
}

function buildMissionAssuranceModuleOverview({ user, baseUrl } = {}) {
    const currentPersona = buildCurrentUserPersona(user);
    const personas = [
        currentPersona,
        ...listMissionPersonas()
    ];
    const actions = listMissionActions();
    const resources = listMissionResources();
    const currentProfile = normalizeUserAccessProfile(user);
    const matrix = buildDecisionMatrix(currentPersona);
    const defaultEvaluation = evaluateMissionAccess({
        subject: currentPersona,
        actionId: 'approve_block_action',
        resourceId: 'autonomy-block-policy',
        contextOverrides: {
            networkZone: currentPersona.networkZones[0] || 'corp',
            justification: currentPersona.breakGlassReason
        }
    });

    return {
        module: {
            name: 'Mission Access Assurance Module',
            focus: 'CAF-style tactical authentication and authorization',
            policyEngine: 'Least-privilege RBAC plus mission-aware ABAC',
            route: '/mission-assurance/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        currentProfile,
        coverage: {
            actionCount: actions.length,
            resourceCount: resources.length,
            personaCount: personas.length,
            allowedDecisionCount: matrix.allowedCount,
            deniedDecisionCount: matrix.deniedCount
        },
        principles: POLICY_PRINCIPLES.map((principle) => ({ ...principle })),
        recommendedControls: RECOMMENDED_CONTROLS.map((control) => ({ ...control })),
        actions,
        resources,
        personas,
        defaultPersonaId: currentPersona.id,
        defaultActionId: defaultEvaluation.action.id,
        defaultResourceId: defaultEvaluation.resource.id,
        defaultNetworkZone: currentPersona.networkZones[0] || 'corp',
        matrix,
        defaultEvaluation
    };
}

function evaluateMissionAssuranceScenario({ user, personaId, actionId, resourceId, contextOverrides } = {}) {
    let subject = buildCurrentUserPersona(user);

    if (personaId && personaId !== 'current-user') {
        subject = getMissionPersona(personaId);

        if (!subject) {
            const error = new Error(`Unknown mission assurance persona: ${personaId}`);
            error.code = 'UNKNOWN_PERSONA';
            throw error;
        }
    }

    return evaluateMissionAccess({
        user,
        subject,
        actionId,
        resourceId,
        contextOverrides
    });
}

module.exports = {
    buildMissionAssuranceModuleOverview,
    evaluateMissionAssuranceScenario
};
