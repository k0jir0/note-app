const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

const SELF_HEALING_ROUTE = '/self-healing';
const SELF_HEALING_MODULE_ROUTE = '/self-healing/module';
const LEGACY_LOCATOR_REPAIR_ROUTE = '/locator-repair';
const LEGACY_LOCATOR_REPAIR_MODULE_ROUTE = '/locator-repair/module';

router.get(SELF_HEALING_ROUTE, requireAuth, (req, res) => {
    res.redirect(SELF_HEALING_MODULE_ROUTE);
});

router.get(SELF_HEALING_MODULE_ROUTE, requireAuth, (req, res) => {
    res.render('pages/locator-repair-module.ejs', {
        title: 'Self-Healing Locator Repair Module',
        csrfToken: res.locals.csrfToken
    });
});

router.get(LEGACY_LOCATOR_REPAIR_ROUTE, requireAuth, (req, res) => {
    res.redirect(SELF_HEALING_MODULE_ROUTE);
});

router.get(LEGACY_LOCATOR_REPAIR_MODULE_ROUTE, requireAuth, (req, res) => {
    res.redirect(SELF_HEALING_MODULE_ROUTE);
});

module.exports = router;
