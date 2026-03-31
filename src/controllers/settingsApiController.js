const mongoose = require('mongoose');

const userPreferencesService = require('../services/userPreferencesService');
const accountAdministrationService = require('../services/accountAdministrationService');
const { ACCOUNT_STATUSES } = require('../services/accountLifecycleService');
const User = require('../models/User');
const {
    sanitizeString,
    validateEmail,
    validatePassword
} = require('../utils/validation');

const MISSION_ROLE_OPTIONS = new Set(User.schema.path('accessProfile.missionRole').enumValues);
const CLEARANCE_OPTIONS = new Set(User.schema.path('accessProfile.clearance').enumValues);
const DEVICE_TIER_OPTIONS = new Set(User.schema.path('accessProfile.deviceTier').enumValues);
const ACCOUNT_STATUS_OPTIONS = new Set(Object.values(ACCOUNT_STATUSES));

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStringArray(value, fieldName, errors) {
    if (!Array.isArray(value)) {
        errors.push(`${fieldName} must be an array of strings when provided`);
        return [];
    }

    const normalized = value.map((entry) => sanitizeString(entry));
    if (normalized.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        errors.push(`${fieldName} must contain only non-empty strings`);
        return [];
    }

    return [...new Set(normalized.map((entry) => entry.trim()))];
}

function validateAccessProfilePayload(payload) {
    if (payload === undefined) {
        return {
            isValid: true,
            value: {}
        };
    }

    if (!isPlainObject(payload)) {
        return {
            isValid: false,
            errors: ['accessProfile must be an object when provided'],
            value: {}
        };
    }

    const errors = [];
    const normalized = {};

    if (payload.missionRole !== undefined) {
        const missionRole = String(payload.missionRole || '').trim().toLowerCase();
        if (!MISSION_ROLE_OPTIONS.has(missionRole)) {
            errors.push(`missionRole must be one of: ${[...MISSION_ROLE_OPTIONS].join(', ')}`);
        } else {
            normalized.missionRole = missionRole;
        }
    }

    if (payload.clearance !== undefined) {
        const clearance = String(payload.clearance || '').trim().toLowerCase();
        if (!CLEARANCE_OPTIONS.has(clearance)) {
            errors.push(`clearance must be one of: ${[...CLEARANCE_OPTIONS].join(', ')}`);
        } else {
            normalized.clearance = clearance;
        }
    }

    if (payload.unit !== undefined) {
        if (typeof payload.unit !== 'string') {
            errors.push('unit must be a string when provided');
        } else {
            const unit = sanitizeString(payload.unit);
            if (!unit) {
                errors.push('unit must be a non-empty string when provided');
            } else {
                normalized.unit = unit;
            }
        }
    }

    if (payload.assignedMissions !== undefined) {
        normalized.assignedMissions = normalizeStringArray(payload.assignedMissions, 'assignedMissions', errors);
    }

    if (payload.deviceTier !== undefined) {
        const deviceTier = String(payload.deviceTier || '').trim().toLowerCase();
        if (!DEVICE_TIER_OPTIONS.has(deviceTier)) {
            errors.push(`deviceTier must be one of: ${[...DEVICE_TIER_OPTIONS].join(', ')}`);
        } else {
            normalized.deviceTier = deviceTier;
        }
    }

    if (payload.networkZones !== undefined) {
        normalized.networkZones = normalizeStringArray(payload.networkZones, 'networkZones', errors);
    }

    return {
        isValid: errors.length === 0,
        errors,
        value: normalized
    };
}

async function updateThemePreference(req, res) {
    try {
        const user = req.user;
        if (!user || !user._id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { nightMode } = req.body || {};
        if (typeof nightMode !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const result = await userPreferencesService.updateNightModePreference(user._id, nightMode);

        if (req.user && req.user.preferences) {
            req.user.preferences.nightMode = nightMode;
        }

        return res.json(result);
    } catch (error) {
        console.error('Error updating theme preference', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function listManagedAccounts(req, res) {
    try {
        const accounts = await accountAdministrationService.listManagedAccounts();
        return res.json({
            success: true,
            accounts
        });
    } catch (error) {
        console.error('Error listing managed accounts', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function provisionManagedAccount(req, res) {
    try {
        const { email, password, name, accessProfile } = req.body || {};
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({ success: false, message: emailValidation.error });
        }

        if (password !== undefined && typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'password must be a string when provided' });
        }

        const normalizedPassword = typeof password === 'string' ? password.trim() : '';
        if (normalizedPassword) {
            const passwordValidation = validatePassword(normalizedPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({ success: false, message: passwordValidation.errors.join('. ') });
            }
        }

        if (name !== undefined && typeof name !== 'string') {
            return res.status(400).json({ success: false, message: 'name must be a string when provided' });
        }

        const accessProfileValidation = validateAccessProfilePayload(accessProfile);
        if (!accessProfileValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: accessProfileValidation.errors.join('. ')
            });
        }

        const result = await accountAdministrationService.provisionManagedAccount({
            email: String(email || '').trim().toLowerCase(),
            password: normalizedPassword,
            name: typeof name === 'string' ? sanitizeString(name) : '',
            accessProfile: accessProfileValidation.value,
            actor: req.user && (req.user.email || req.user._id) ? String(req.user.email || req.user._id) : 'authorized-admin'
        });

        return res.status(result.created ? 201 : 200).json({
            success: true,
            created: result.created,
            account: result.account
        });
    } catch (error) {
        console.error('Error provisioning managed account', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function updateManagedAccountState(req, res) {
    try {
        const userId = String(req.params && req.params.userId || '').trim();
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user id' });
        }

        const status = String(req.body && req.body.status || '').trim().toLowerCase();
        if (!ACCOUNT_STATUS_OPTIONS.has(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${[...ACCOUNT_STATUS_OPTIONS].join(', ')}`
            });
        }

        const reason = typeof req.body?.reason === 'string'
            ? sanitizeString(req.body.reason)
            : '';
        if (status === ACCOUNT_STATUSES.DISABLED && !reason) {
            return res.status(400).json({
                success: false,
                message: 'reason is required when disabling an account'
            });
        }

        const account = await accountAdministrationService.updateManagedAccountState({
            userId,
            status,
            reason,
            actor: req.user && (req.user.email || req.user._id) ? String(req.user.email || req.user._id) : 'authorized-admin'
        });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        return res.json({
            success: true,
            account
        });
    } catch (error) {
        console.error('Error updating managed account state', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = {
    listManagedAccounts,
    provisionManagedAccount,
    updateManagedAccountState,
    updateThemePreference
};
