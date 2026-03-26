const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');

// Update user preferences (expects JSON { nightMode: true|false })
router.post('/api/settings/theme', requireAuthAPI, async (req, res) => {
    try {
        const User = require('../models/User');
        const user = req.user;
        if (!user || !user._id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { nightMode } = req.body;
        if (typeof nightMode !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        await User.updateOne({ _id: user._id }, { $set: { 'preferences.nightMode': nightMode } });

        // reflect the change in session user object if present
        if (req.user && req.user.preferences) {
            req.user.preferences.nightMode = nightMode;
        }

        return res.json({ success: true, nightMode });
    } catch (err) {
        console.error('Error updating theme preference', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
