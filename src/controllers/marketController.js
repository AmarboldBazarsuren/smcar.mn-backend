const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// GET /api/market/brands
// Брэнд тус бүрд нийт машин тоо + загваруудыг буцаана
exports.getBrands = async (req, res) => {
  try {
    const data = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data: data.map(d => ({ id: d._id, name: d._id, count: d.count })) });
  } catch (err) {
    logger.error(`getBrands алдаа: ${err.message}`);
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};

// GET /api/market/brands/:brand/models
// Тухайн брэндийн загваруудыг тоотой буцаана
exports.getModels = async (req, res) => {
  try {
    const { brand } = req.params;
    const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const data = await Vehicle.aggregate([
      { $match: { status: 'active', brand: new RegExp(`^${escapeRegex(brand)}$`, 'i') } },
      { $group: { _id: '$model', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);
    res.json({ success: true, data: data.map(d => ({ model: d._id, count: d.count })) });
  } catch (err) {
    logger.error(`getModels алдаа: ${err.message}`);
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};

// GET /api/market/brands-with-models
// Бүх брэнд + тэдгээрийн загварууд нэг дор (Home page-д хэрэглэнэ)
exports.getBrandsWithModels = async (req, res) => {
  try {
    const data = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      // Брэнд + загвараар бүлэглэх
      { $group: { _id: { brand: '$brand', model: '$model' }, count: { $sum: 1 } } },
      { $sort: { '_id.brand': 1, count: -1 } },
      // Брэндээр нь цуглуулах
      {
        $group: {
          _id: '$_id.brand',
          total: { $sum: '$count' },
          models: {
            $push: { model: '$_id.model', count: '$count' }
          }
        }
      },
      { $sort: { total: -1 } },
      // Top 20 брэнд
      { $limit: 20 },
    ]);

    // Загварыг тоогоор эрэмбэлж, top 10-г авна
    const result = data.map(d => ({
      brand:  d._id,
      total:  d.total,
      models: d.models
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`getBrandsWithModels алдаа: ${err.message}`);
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};

// POST /api/market/sync — manual sync trigger
exports.triggerSync = async (req, res) => {
  try {
    const syncService = require('../services/syncService');
    if (syncService.isRunning) {
      return res.status(409).json({ success: false, message: 'Sync аль хэдийн ажиллаж байна' });
    }
    syncService.runSync('manual').catch(err => logger.error(`Manual sync алдаа: ${err.message}`));
    res.json({ success: true, message: 'Sync эхэллээ' });
  } catch (err) {
    logger.error(`triggerSync алдаа: ${err.message}`);
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};

// GET /api/market/sync/status
exports.getSyncStatus = async (req, res) => {
  try {
    const syncService = require('../services/syncService');
    const status  = await syncService.getSyncStatus();
    const history = await syncService.getSyncHistory(10);
    res.json({ success: true, data: { ...status, history } });
  } catch (err) {
    logger.error(`getSyncStatus алдаа: ${err.message}`);
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};