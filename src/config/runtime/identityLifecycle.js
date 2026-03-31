const { parseBooleanEnv } = require('./helpers');
const { isProtectedRuntimeEnvironment } = require('./database');

function resolveBooleanSetting(name, env, errors, defaultValue) {
    if (env[name] === undefined) {
        return defaultValue;
    }

    return parseBooleanEnv(name, env, errors);
}

function buildIdentityLifecycleConfig(env = process.env, errors = []) {
    const protectedRuntime = isProtectedRuntimeEnvironment(env);
    const selfSignupEnabled = resolveBooleanSetting(
        'SELF_SIGNUP_ENABLED',
        env,
        errors,
        !protectedRuntime
    );
    const googleAutoProvisionEnabled = resolveBooleanSetting(
        'GOOGLE_AUTO_PROVISION_ENABLED',
        env,
        errors,
        selfSignupEnabled
    );

    if (protectedRuntime && selfSignupEnabled) {
        errors.push('SELF_SIGNUP_ENABLED must remain false in protected runtime environments');
    }

    if (protectedRuntime && googleAutoProvisionEnabled) {
        errors.push('GOOGLE_AUTO_PROVISION_ENABLED must remain false in protected runtime environments');
    }

    return {
        protectedRuntime,
        selfSignupEnabled,
        googleAutoProvisionEnabled
    };
}

module.exports = {
    buildIdentityLifecycleConfig
};
