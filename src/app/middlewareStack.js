const path = require('path');

const express = require('express');
const helmet = require('helmet');

const { buildHelmetProtectionOptions } = require('../config/xssDefense');
const { attachBreakGlassState } = require('../middleware/breakGlass');
const { ensureCsrfToken, requireCsrfProtection } = require('../middleware/csrf');
const { attachSessionAuthAssurance } = require('../middleware/sessionAuthAssurance');
const { enforceServerSideApiAccessControl } = require('../middleware/apiAccessControl');
const { enforceInjectionPrevention } = require('../middleware/injectionPrevention');
const { enforceStrictSessionManagement } = require('../middleware/sessionManagement');
const { sanitizeResponseMetadata } = require('../middleware/responseMetadataProtection');
const { createImmutableRequestAuditMiddleware } = require('../middleware/immutableRequestAudit');
const { enforceSecureTransport } = require('../middleware/secureTransport');
const { requestContextMiddleware } = require('../utils/requestContext');

function attachAuthenticatedUserToViews(req, res, next) {
    res.locals.user = req.user || null;
    next();
}

function registerApplicationMiddleware(app, {
    rootDir,
    isProduction = false,
    immutableLogClient = null,
    sessionMiddleware = null,
    passportInstance = null,
    injectSessionPrincipal = null
} = {}) {
    app.use(sanitizeResponseMetadata);
    app.use(helmet(buildHelmetProtectionOptions({ isProduction })));
    app.use(requestContextMiddleware);
    app.use(enforceSecureTransport);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(enforceInjectionPrevention);
    app.use(createImmutableRequestAuditMiddleware({ client: immutableLogClient }));
    app.use('/vendor/bootstrap', express.static(path.join(rootDir, 'node_modules', 'bootstrap', 'dist')));
    app.use('/vendor/bootstrap-icons', express.static(path.join(rootDir, 'node_modules', 'bootstrap-icons')));
    app.use(express.static(path.join(rootDir, 'src', 'views', 'public')));

    app.get('/placeholder.jpg', (req, res) => {
        res.sendFile(path.join(rootDir, 'src', 'image', 'placeholder.jpg'));
    });

    if (sessionMiddleware) {
        app.use(sessionMiddleware);
    }

    if (passportInstance) {
        app.use(passportInstance.initialize());
        app.use(passportInstance.session());
    }

    if (typeof injectSessionPrincipal === 'function') {
        app.use(injectSessionPrincipal);
    }

    app.use(attachAuthenticatedUserToViews);
    app.use(enforceStrictSessionManagement);
    app.use(attachSessionAuthAssurance);
    app.use(enforceServerSideApiAccessControl);
    app.use(ensureCsrfToken);
    app.use(requireCsrfProtection);
    app.use(attachBreakGlassState);

    return app;
}

module.exports = {
    registerApplicationMiddleware
};
