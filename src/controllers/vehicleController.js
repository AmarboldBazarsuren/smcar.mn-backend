const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// Special regex char-уудыг escape хийх — server crash болохоос сэргийлнэ
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─────────────────────────────────────────
// БҮГДИЙГ АВАХ + ШҮҮЛТ + ХУУДАСЧЛАЛ
// GET /api/vehicles
// ─────────────────────────────────────────
exports.getVehicles = async (req, res) => {
  try {
    const {
      brand, model, year_min, year_max,
      price_min, price_max, fuel_type,
      transmission, location, status,
      search, sort = '-createdAt',
      page = 1, limit = 20,
    } = req.query;

    const filter = {};
    filter.status = status || 'active';

    // Brand — exact case-insensitive match (Hyundai, KIA гэх мэт)
    if (brand) {
      const safeBrand = escapeRegex(brand.trim());
      // Encar дата дотор brand нь "HY" эсвэл "Hyundai" гэж байж болох тул flexible хайлт
      filter.$or = filter.$or || [];
      filter.brand = new RegExp(`^${safeBrand}$`, 'i');
      delete filter.$or;
    }

    if (model) filter.model = new RegExp(escapeRegex(model.trim()), 'i');

    if (year_min || year_max) {
      filter.year = {};
      if (year_min) filter.year.$gte = parseInt(year_min);
      if (year_max) filter.year.$lte = parseInt(year_max);
    }

    if (price_min || price_max) {
      filter.price = {};
      if (price_min) filter.price.$gte = parseInt(price_min);
      if (price_max) filter.price.$lte = parseInt(price_max);
    }

    if (fuel_type)    filter.fuelType     = new RegExp(`^${escapeRegex(fuel_type.trim())}$`, 'i');
    if (transmission) filter.transmission = new RegExp(escapeRegex(transmission.trim()), 'i');
    if (location)     filter.location     = new RegExp(escapeRegex(location.trim()), 'i');

    // Text search — brand, model, title дотор хайна + fuel_type/bodyType-оор хайх боломж
    if (search) {
      const safeSearch = escapeRegex(search.trim());
      filter.$or = [
        { title:    new RegExp(safeSearch, 'i') },
        { brand:    new RegExp(safeSearch, 'i') },
        { model:    new RegExp(safeSearch, 'i') },
        { badge:    new RegExp(safeSearch, 'i') },
        { fuelType: new RegExp(safeSearch, 'i') },
        { bodyType: new RegExp(safeSearch, 'i') },
        { description: new RegExp(safeSearch, 'i') },
      ];
      // brand filter байвал $or-той давхцахгүйн тулд brand-г хасна
      if (filter.brand) delete filter.brand;
    }

    const pageNum  = Math.max(1, parseInt(page));
const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      Vehicle.countDocuments(filter),
    ]);

    logger.debug(`getVehicles: filter=${JSON.stringify(filter)}, total=${total}, returned=${vehicles.length}`);

    res.json({
      success: true,
      data: {
        vehicles,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1,
        },
      },
    });
  } catch (error) {
    logger.error(`getVehicles алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// НЭГ МАШИН АВАХ
// GET /api/vehicles/:id
// ─────────────────────────────────────────
exports.getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    // MongoDB ObjectId эсвэл encarId-аар хайна
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isObjectId
      ? { $or: [{ _id: id }, { encarId: id }] }
      : { encarId: id };

    const vehicle = await Vehicle.findOne(query).select('-__v');

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Үзэлт нэмэх
    Vehicle.findByIdAndUpdate(vehicle._id, { $inc: { viewCount: 1 } }).exec();

    res.json({ success: true, data: vehicle });
  } catch (error) {
    logger.error(`getVehicleById алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// ОНЦЛОХ МАШИНУУД
// GET /api/vehicles/featured
// ─────────────────────────────────────────
exports.getFeaturedVehicles = async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 8);
    const vehicles = await Vehicle.find({ status: 'active' })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: vehicles });
  } catch (error) {
    logger.error(`getFeaturedVehicles алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// СТАТИСТИК
// GET /api/vehicles/stats
// ─────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [totalActive, totalSold, brandStats, avgPrice, recentCount] = await Promise.all([
      Vehicle.countDocuments({ status: 'active' }),
      Vehicle.countDocuments({ status: 'sold' }),
      Vehicle.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      Vehicle.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, avg: { $avg: '$price' } } },
      ]),
      Vehicle.countDocuments({
        status: 'active',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        totalSold,
        recentCount,
        averagePrice:  avgPrice[0]?.avg || 0,
        topBrands:     brandStats,
      },
    });
  } catch (error) {
    logger.error(`getStats алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// ҮНЭ ТҮҮХ
// GET /api/vehicles/:id/price-history
// ─────────────────────────────────────────
exports.getPriceHistory = async (req, res) => {
  res.json({ success: true, data: { price_history: [], trend: 'stable' } });
};