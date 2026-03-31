const passport = require('passport');

const { CSRF_BODY_FIELD } = require('../middleware/csrf');
const {
    validateEmail,
    validatePassword,
    validateLoginPassword,
    sanitizeAuthPayload
} = require('../utils/validation');
const { handleAuthFailure } = require('../utils/errorHandler');
const authService = require('../services/authService');
const { isSelfSignupEnabled } = require('../services/identityProvisioningService');

const AUTH_PAYLOAD_FIELDS = ['email', 'password', CSRF_BODY_FIELD];

function hasUnexpectedAuthFields(body = {}) {
    return Object.keys(body).some((key) => !AUTH_PAYLOAD_FIELDS.includes(key));
}

function renderLogin(req, res) {
    const sessionReason = typeof req.query?.reason === 'string'
        ? authService.getLoginReasonMessage(req.query.reason)
        : '';

    return authService.renderLoginPage(res, {
        error: sessionReason || null
    });
}

function renderSignup(req, res) {
    return authService.renderSignupPage(res);
}

function renderLogout(req, res) {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    return authService.renderLogoutPage(res);
}

function handleLogin(req, res, next) {
    const { email, password } = sanitizeAuthPayload(req.body);

    if (hasUnexpectedAuthFields(req.body)) {
        return authService.renderLoginPage(res, {
            error: 'Invalid login request payload'
        });
    }

    if (!email || !password) {
        return authService.renderLoginPage(res, {
            error: 'Please provide both email and password'
        });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return authService.renderLoginPage(res, {
            error: emailValidation.error
        });
    }

    const passwordValidation = validateLoginPassword(password);
    if (!passwordValidation.isValid) {
        return authService.renderLoginPage(res, {
            error: passwordValidation.error
        });
    }

    req.body.email = email;
    req.body.password = password;

    return passport.authenticate('local', async (error, user, info) => {
        if (error) {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: authService.GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!user) {
            return authService.renderLoginPage(res, {
                error: info && info.code === 'ACCOUNT_LOCKED'
                    ? authService.ACCOUNT_LOCKED_ERROR
                    : authService.GENERIC_LOGIN_ERROR
            });
        }

        if (!req.session || typeof req.session.regenerate !== 'function') {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: authService.GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        try {
            await authService.completeAuthenticatedLogin(req, user);
            return res.redirect('/');
        } catch (_error) {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: authService.GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }
    })(req, res, next);
}

async function handleSignup(req, res) {
    try {
        const runtimeConfig = req.app && req.app.locals ? req.app.locals.runtimeConfig || {} : {};
        if (!isSelfSignupEnabled(runtimeConfig)) {
            return res.status(403).render('pages/signup', {
                title: 'Sign Up',
                error: authService.SELF_SIGNUP_DISABLED_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        const { email, password } = sanitizeAuthPayload(req.body);

        if (hasUnexpectedAuthFields(req.body)) {
            return authService.renderSignupPage(res, {
                error: 'Invalid signup request payload'
            });
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return authService.renderSignupPage(res, {
                error: emailValidation.error
            });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return authService.renderSignupPage(res, {
                error: passwordValidation.errors.join('. ')
            });
        }

        const existingUser = await authService.findExistingUserByEmail(email);
        if (existingUser) {
            return res.redirect('/auth/login');
        }

        await authService.createLocalUser({ email, password });
        return res.redirect('/auth/login');
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map((entry) => entry.message);
            return authService.renderSignupPage(res, {
                error: errorMessages.join('. ')
            });
        }

        return res.status(500).render('pages/signup', {
            title: 'Sign Up',
            error: 'An error occurred during signup. Please try again.',
            csrfToken: res.locals.csrfToken
        });
    }
}

async function handleLogout(req, res) {
    try {
        await authService.destroyAuthenticatedSession(req, res);
        return res.redirect('/auth/login');
    } catch (_error) {
        return handleAuthFailure(res, {
            api: false,
            statusCode: 503,
            pageTitle: 'Logout',
            pageError: 'Logout could not be completed safely.',
            csrfToken: res.locals.csrfToken
        });
    }
}

function beginGoogleLogin(req, res, next) {
    if (!authService.hasGoogleAuthCredentials()) {
        return authService.renderLoginPage(res, {
            error: 'Google sign-in is not configured'
        });
    }

    if (authService.maybeRedirectToConfiguredAppBaseUrl(req, res)) {
        return undefined;
    }

    return passport.authenticate('google')(req, res, next);
}

function handleGoogleCallback(req, res, next) {
    if (!authService.hasGoogleAuthCredentials()) {
        return authService.renderLoginPage(res, {
            error: 'Google sign-in is not configured'
        });
    }

    if (authService.maybeRedirectToConfiguredAppBaseUrl(req, res)) {
        return undefined;
    }

    return passport.authenticate('google', async (error, user, info) => {
        if (error) {
            if (authService.isGoogleTokenExchangeError(error)) {
                console.warn('[auth] Google token exchange failed. Verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL, and the Google Cloud redirect URI for this environment.');
                return res.status(502).render('pages/login', {
                    title: 'Login',
                    error: authService.GOOGLE_OAUTH_EXCHANGE_ERROR_MESSAGE,
                    csrfToken: res.locals.csrfToken
                });
            }

            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: authService.GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!user) {
            return authService.renderLoginPage(res, {
                error: info && info.code === 'ACCOUNT_LOCKED'
                    ? authService.ACCOUNT_LOCKED_ERROR
                    : (info && info.code === 'IDENTITY_NOT_PROVISIONED'
                        ? authService.GOOGLE_IDENTITY_PROVISIONING_ERROR
                        : null)
            });
        }

        try {
            await authService.completeAuthenticatedLogin(req, user);
            return res.redirect('/');
        } catch (_error) {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: authService.GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }
    })(req, res, next);
}

module.exports = {
    beginGoogleLogin,
    handleGoogleCallback,
    handleLogin,
    handleLogout,
    handleSignup,
    renderLogin,
    renderLogout,
    renderSignup
};
