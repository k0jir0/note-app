const User = require('../models/User');

async function updateNightModePreference(userId, nightMode) {
    await User.updateOne({ _id: userId }, { $set: { 'preferences.nightMode': nightMode } });

    return {
        success: true,
        nightMode
    };
}

module.exports = {
    updateNightModePreference
};
