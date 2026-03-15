const encarService = require('../services/encarService');
const syncService = require('../services/syncService');
const Vehicle = require('../models/Vehicle');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// БРЕНД ЖАГСААЛТ
// ─────────────────────────────────────────
exports.getBrands = async (req, res) => {
  try {
    // Эхлээд локал DB-ээс авах
    const localBrands = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    if (localBrands.length > 0) {
      return res.json({
        success: true,
        data: localBrands.map(b => ({ id: b._id, name: b._id, count: b.count })),
        source: 'local',
      });
    }

    // Хэрэв локал дата байхгүй бол API-аас авах
    const response = await encarService.getBrands();
    res.json({ success: true, data: response.data, source: 'api' });
  } catch (error) {
    logger.error(`getBrands алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Брэнд авахад алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// БРЕНДИЙН ЗАГВАРУУД
// ─────────────────────────────────────────
exports.getModelsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;

    // Локал DB-ээс авах
    const localModels = await Vehicle.aggregate([
      { $match: { brand: new RegExp(brand, 'i'), status: 'active' } },
      { $group: { _id: '$model', count: { $sum: 1 }, years: { $addToSet: '$year' } } },
      { $sort: { count: -1 } },
    ]);

    if (localModels.length > 0) {
      return res.json({
        success: true,
        data: localModels.map(m => ({
          id: m._id,
          name: m._id,
          count: m.count,
          years: m.years.sort((a, b) => b - a),
        })),
        source: 'local',
      });
    }

    const response = await encarService.getModelsByBrand(brand);
    res.json({ success: true, data: response.data, source: 'api' });
  } catch (error) {
    logger.error(`getModelsByBrand алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Загвар авахад алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// ЗАХЫН СТАТИСТИК
// ─────────────────────────────────────────
exports.getMarketStats = async (req, res) => {
  try {
    const response = await encarService.getMarketStats();
    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error(`getMarketStats алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Статистик авахад алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// ГАРААР СИНК ХИЙХ
// ─────────────────────────────────────────
exports.triggerSync = async (req, res) => {
  try {
    if (syncService.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'Синк аль хэдийн ажиллаж байна',
      });
    }

    // Background-д ажиллуулах
    syncService.runSync('manual').catch(err => {
      logger.error(`Гараар синк алдаа: ${err.message}`);
    });

    res.json({
      success: true,
      message: 'Синк эхэллээ. Хэдэн минутын дараа шинэ машинууд харагдана.',
    });
  } catch (error) {
    logger.error(`triggerSync алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Синк эхлүүлэхэд алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// СИНКИЙН СТАТУС
// ─────────────────────────────────────────
exports.getSyncStatus = async (req, res) => {
  try {
    const status = await syncService.getSyncStatus();
    const history = await syncService.getSyncHistory(10);
    res.json({ success: true, data: { ...status, history } });
  } catch (error) {
    logger.error(`getSyncStatus алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Статус авахад алдаа гарлаа' });
  }
};
