const Vehicle = require('../models/Vehicle');
const encarService = require('../services/encarService');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// БҮГДИЙГ АВАХ + ШҮҮЛТ + ХУУДАСЧЛАЛ
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

    // Статус (default: зөвхөн идэвхтэй)
    filter.status = status || 'active';

    // Брэнд, загвар
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (model) filter.model = new RegExp(model, 'i');

    // Он
    if (year_min || year_max) {
      filter.year = {};
      if (year_min) filter.year.$gte = parseInt(year_min);
      if (year_max) filter.year.$lte = parseInt(year_max);
    }

    // Үнэ
    if (price_min || price_max) {
      filter.price = {};
      if (price_min) filter.price.$gte = parseInt(price_min);
      if (price_max) filter.price.$lte = parseInt(price_max);
    }

    // Бусад шүүлт
    if (fuel_type) filter.fuelType = new RegExp(fuel_type, 'i');
    if (transmission) filter.transmission = new RegExp(transmission, 'i');
    if (location) filter.location = new RegExp(location, 'i');

    // Текст хайлт
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { model: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    // Хуудасчлал
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Мэдээлэл татах
    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      Vehicle.countDocuments(filter),
    ]);

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
// ─────────────────────────────────────────
exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { encarId: req.params.id },
      ]
    }).select('-__v');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Машин олдсонгүй',
      });
    }

    // Үзэлт нэмэх
    await Vehicle.findByIdAndUpdate(vehicle._id, { $inc: { viewCount: 1 } });

    res.json({ success: true, data: vehicle });
  } catch (error) {
    logger.error(`getVehicleById алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};

// ─────────────────────────────────────────
// ҮНИ ТҮҮХ (Encar-аас шууд татна)
// ─────────────────────────────────────────
exports.getPriceHistory = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ encarId: req.params.id }).lean();
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    const priceHistory = await encarService.getPriceHistory(req.params.id);
    res.json({ success: true, data: priceHistory.data });
  } catch (error) {
    logger.error(`getPriceHistory алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Үнийн түүх авах боломжгүй' });
  }
};

// ─────────────────────────────────────────
// ТОП МАШИНУУД (Их үзэлттэй)
// ─────────────────────────────────────────
exports.getFeaturedVehicles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    
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
// ─────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalActive,
      totalSold,
      brandStats,
      avgPrice,
      recentCount,
    ] = await Promise.all([
      Vehicle.countDocuments({ status: 'active' }),
      Vehicle.countDocuments({ status: 'sold' }),
      Vehicle.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
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
        averagePrice: avgPrice[0]?.avg || 0,
        topBrands: brandStats,
      },
    });
  } catch (error) {
    logger.error(`getStats алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Сервер алдаа гарлаа' });
  }
};
