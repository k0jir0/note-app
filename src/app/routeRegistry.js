const noteApiRoute = require('../routes/noteApiRoutes');
const notePageRoute = require('../routes/notePageRoutes');
const securityApiRoute = require('../routes/securityApiRoutes');
const securityPageRoute = require('../routes/securityPageRoutes');
const mlApiRoute = require('../routes/mlApiRoutes');
const mlPageRoute = require('../routes/mlPageRoutes');
const playwrightApiRoute = require('../routes/playwrightApiRoutes');
const playwrightPageRoute = require('../routes/playwrightPageRoutes');
const locatorRepairApiRoute = require('../routes/locatorRepairApiRoutes');
const locatorRepairPageRoute = require('../routes/locatorRepairPageRoutes');
const xssDefenseApiRoute = require('../routes/xssDefenseApiRoutes');
const xssDefensePageRoute = require('../routes/xssDefensePageRoutes');
const breakGlassApiRoute = require('../routes/breakGlassApiRoutes');
const breakGlassPageRoute = require('../routes/breakGlassPageRoutes');
const accessControlApiRoute = require('../routes/accessControlApiRoutes');
const accessControlPageRoute = require('../routes/accessControlPageRoutes');
const hardwareFirstMfaApiRoute = require('../routes/hardwareFirstMfaApiRoutes');
const hardwareFirstMfaPageRoute = require('../routes/hardwareFirstMfaPageRoutes');
const missionAssuranceApiRoute = require('../routes/missionAssuranceApiRoutes');
const missionAssurancePageRoute = require('../routes/missionAssurancePageRoutes');
const sessionManagementApiRoute = require('../routes/sessionManagementApiRoutes');
const sessionManagementPageRoute = require('../routes/sessionManagementPageRoutes');
const seleniumApiRoute = require('../routes/seleniumApiRoutes');
const seleniumPageRoute = require('../routes/seleniumPageRoutes');
const scanApiRoute = require('../routes/scanApiRoutes');
const scanPageRoute = require('../routes/scanPageRoutes');
const auditTelemetryApiRoute = require('../routes/auditTelemetryApiRoutes');
const auditTelemetryPageRoute = require('../routes/auditTelemetryPageRoutes');
const supplyChainPageRoute = require('../routes/supplyChainPageRoutes');
const injectionPreventionApiRoute = require('../routes/injectionPreventionApiRoutes');
const injectionPreventionPageRoute = require('../routes/injectionPreventionPageRoutes');

const FEATURE_ROUTE_GROUPS = [
    {
        name: 'notes-and-workspace',
        routes: [
            noteApiRoute,
            notePageRoute
        ]
    },
    {
        name: 'analysis-and-operations',
        routes: [
            securityApiRoute,
            securityPageRoute,
            mlApiRoute,
            mlPageRoute,
            playwrightApiRoute,
            playwrightPageRoute
        ]
    },
    {
        name: 'control-modules',
        routes: [
            injectionPreventionApiRoute,
            injectionPreventionPageRoute,
            xssDefenseApiRoute,
            xssDefensePageRoute,
            breakGlassApiRoute,
            breakGlassPageRoute,
            accessControlApiRoute,
            accessControlPageRoute,
            locatorRepairApiRoute,
            locatorRepairPageRoute,
            hardwareFirstMfaApiRoute,
            hardwareFirstMfaPageRoute,
            missionAssuranceApiRoute,
            missionAssurancePageRoute,
            sessionManagementApiRoute,
            sessionManagementPageRoute
        ]
    },
    {
        name: 'assurance-and-telemetry',
        routes: [
            seleniumApiRoute,
            seleniumPageRoute,
            scanApiRoute,
            scanPageRoute,
            auditTelemetryApiRoute,
            supplyChainPageRoute,
            auditTelemetryPageRoute
        ]
    }
];

const FEATURE_ROUTES = FEATURE_ROUTE_GROUPS.flatMap((group) => group.routes);

function normalizeRouteGroups(routeGroupsOrRoutes = FEATURE_ROUTE_GROUPS) {
    if (!Array.isArray(routeGroupsOrRoutes)) {
        return [];
    }

    if (routeGroupsOrRoutes.length === 0) {
        return [];
    }

    if (routeGroupsOrRoutes.every((entry) => entry && Array.isArray(entry.routes))) {
        return routeGroupsOrRoutes;
    }

    return [{
        name: 'custom',
        routes: routeGroupsOrRoutes
    }];
}

function registerFeatureRoutes(app, routeGroups = FEATURE_ROUTE_GROUPS) {
    normalizeRouteGroups(routeGroups).forEach((group) => {
        group.routes.forEach((routeModule) => {
            app.use(routeModule);
        });
    });

    return app;
}

module.exports = {
    FEATURE_ROUTE_GROUPS,
    FEATURE_ROUTES,
    registerFeatureRoutes
};
