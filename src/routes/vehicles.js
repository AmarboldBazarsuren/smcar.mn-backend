const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

// GET /api/vehicles         - Жагсаалт + шүүлт
// GET /api/vehicles/featured - Онцлох машинууд
// GET /api/vehicles/stats    - Статистик
// GET /api/vehicles/:id      - Нэг машин
// GET /api/vehicles/:id/price-history - Үнийн түүх

router.get('/', vehicleController.getVehicles);
router.get('/featured', vehicleController.getFeaturedVehicles);
router.get('/stats', vehicleController.getStats);
router.get('/:id', vehicleController.getVehicleById);
router.get('/:id/price-history', vehicleController.getPriceHistory);

module.exports = router;
