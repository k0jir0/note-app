const express = require('express');
const recipes = require('../models/recipes');

const router = express.Router();

router.get('/', (req, res) => {
    res.json(recipes);
})

module.exports = router;

