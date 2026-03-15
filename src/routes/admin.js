
const express = require('express');
const router  = express.Router();

const authRoutes     = require('./adminAuth');
const vehicleRoutes  = require('./adminVehicles');
const pricingRoutes  = require('./adminPricing');
const statsRoutes    = require('./adminStats');

// Auth: POST /api/admin/login | /setup | GET /api/admin/me
router.use('/', authRoutes);

// Stats: GET /api/admin/stats
router.use('/stats', statsRoutes);

// Vehicles: GET|POST /api/admin/vehicles  |  PUT|DELETE /api/admin/vehicles/:id  |  DELETE /api/admin/vehicles/:id/images/:idx
router.use('/vehicles', vehicleRoutes);

// Pricing: PUT /api/admin/pricing/:id  |  POST /api/admin/pricing/global
router.use('/pricing', pricingRoutes);

module.exports = router;