const express = require('express');
const router  = express.Router();
const { getStats } = require('../controllers/adminStatsController');
const { protect }  = require('../middleware/auth');

// GET /api/admin/stats   — Dashboard статистик
router.get('/', protect, getStats);

module.exports = router;