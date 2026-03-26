const {
    buildCurrentHardwareMfaSession,
    clearExpiredHardwareMfaState,
    mergeSessionHardwareMfaIntoUser
} = require('../services/hardwareFirstMfaService');

function attachSessionAuthAssurance(req, res, next) {
    clearExpiredHardwareMfaState(req.session);

    if (req.user) {
        req.user = mergeSessionHardwareMfaIntoUser(req.user, req.session);
    }

    res.locals.sessionAuthAssurance = buildCurrentHardwareMfaSession(req.session);
    next();
}

module.exports = {
    attachSessionAuthAssurance
};
