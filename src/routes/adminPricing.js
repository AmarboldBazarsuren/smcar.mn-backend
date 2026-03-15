const express = require('express');
const router  = express.Router();
const adminPricingController = require('../controllers/adminPricingController');
const { protect } = require('../middleware/auth');

// POST /api/admin/pricing/global  ← /global ЗААВАЛ /:id-ийн ӨМНӨ байх ёстой
router.post('/global', protect, adminPricingController.updateGlobalRate);

// PUT /api/admin/pricing/:id
router.put('/:id', protect, adminPricingController.updatePricing);

module.exports = router;