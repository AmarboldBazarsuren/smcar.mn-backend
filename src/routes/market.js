const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');

// GET  /api/market/brands          - Брэнд жагсаалт
// GET  /api/market/models/:brand   - Брэндийн загварууд
// GET  /api/market/stats           - Захын статистик
// POST /api/market/sync            - Гараар синк
// GET  /api/market/sync/status     - Синкийн статус

router.get('/brands', marketController.getBrands);
router.get('/models/:brand', marketController.getModelsByBrand);
router.get('/stats', marketController.getMarketStats);
router.post('/sync', marketController.triggerSync);
router.get('/sync/status', marketController.getSyncStatus);

module.exports = router;
