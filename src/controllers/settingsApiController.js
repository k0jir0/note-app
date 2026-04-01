const userPreferencesService = require('../services/userPreferencesService');

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

module.exports = {
    updateThemePreference
};
