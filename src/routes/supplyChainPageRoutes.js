const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { handlePageError } = require('../utils/errorHandler');
const { buildSupplyChainModuleViewModel } = require('../services/march29ResearchModuleService');

router.get('/supply-chain', requireAuth, (req, res) => {
    res.redirect('/supply-chain/module');
});

router.get('/supply-chain/module', requireAuth, (req, res) => {
    try {
        res.render('pages/supply-chain-module.ejs', {
            title: 'Supply Chain Module',
            csrfToken: res.locals.csrfToken,
            moduleData: buildSupplyChainModuleViewModel()
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load the supply chain module');
    }
});

module.exports = router;