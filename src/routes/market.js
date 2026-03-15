const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/marketController');

router.get('/brands',              ctrl.getBrands);
router.get('/brands-with-models',  ctrl.getBrandsWithModels);
router.get('/brands/:brand/models',ctrl.getModels);
router.post('/sync',               ctrl.triggerSync);
router.get('/sync/status',         ctrl.getSyncStatus);

module.exports = router;