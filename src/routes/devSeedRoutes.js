const express = require('express');
const bcrypt = require('bcrypt');

const { requireAuth } = require('../middleware/auth');
const { destructiveActionRateLimiter } = require('../middleware/rateLimit');
const {
    requirePrivilegedDevToolsEnabled,
    requirePrivilegedRuntimeMutationAccess,
    requireRecentPrivilegedStepUp
} = require('../middleware/privilegedRuntime');
const User = require('../models/User');
const Notes = require('../models/Notes');
const { buildSeedResponseMessage, seedDevelopmentData } = require('../services/devSeedService');

const router = express.Router();

router.post(
    '/seed',
    requireAuth,
    requirePrivilegedDevToolsEnabled({ api: false }),
    requirePrivilegedRuntimeMutationAccess({ api: false }),
    requireRecentPrivilegedStepUp({ api: false }),
    destructiveActionRateLimiter,
    async (req, res) => {
        try {
            const seedSummary = await seedDevelopmentData({
                User,
                Notes,
                bcryptLib: bcrypt
            });

            return res.type('text/plain').send(buildSeedResponseMessage(seedSummary));
        } catch (error) {
            console.error('Development seed failed:', error);
            return res.status(500).send('Database seeding failed. Please try again later.');
        }
    }
);

module.exports = router;
