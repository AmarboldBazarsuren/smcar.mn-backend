const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');
const Admin   = require('../models/Admin');
const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// ─────────────────────────────────────────
// JWT TOKEN ҮҮСГЭХ
// ─────────────────────────────────────────
const signToken = (id) => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// ─────────────────────────────────────────
// LOGIN
// POST /api/admin/login
// ─────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Нэвтрэх нэр болон нууц үг оруулна уу',
      });
    }

    // Admin хайх (password-ийг explicitly select хийх)
    const admin = await Admin.findOne({ username: username.toLowerCase() }).select('+password');

    if (!admin) {
      logger.auth.loginFailed(username, ip, 'Admin олдсонгүй');
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу',
      });
    }

    // Нууц үг шалгах
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      logger.auth.loginFailed(username, ip, 'Нууц үг буруу');
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу',
      });
    }

    // Login бүртгэх
    await Admin.findByIdAndUpdate(admin._id, {
      lastLogin:  new Date(),
      $inc: { loginCount: 1 },
    });

    const token = signToken(admin._id);
    logger.auth.loginSuccess(username, ip);

    res.json({
      success: true,
      token,
      admin: {
        id:       admin._id,
        username: admin.username,
        name:     admin.name,
      },
    });
  } catch (error) {
    logger.error(`Login алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// ADMIN МЭДЭЭЛЭЛ
// GET /api/admin/me
// ─────────────────────────────────────────
exports.getMe = (req, res) => {
  res.json({
    success: true,
    admin: {
      id:         req.admin._id,
      username:   req.admin.username,
      name:       req.admin.name,
      lastLogin:  req.admin.lastLogin,
      loginCount: req.admin.loginCount,
    },
  });
};

// ─────────────────────────────────────────
// МАШИНУУДЫН ЖАГСААЛТ (Admin)
// GET /api/admin/vehicles
// ─────────────────────────────────────────
exports.getVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { model: new RegExp(search, 'i') },
        { encarId: new RegExp(search, 'i') },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip     = (pageNum - 1) * limitNum;

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limitNum)
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
        },
      },
    });
  } catch (error) {
    logger.error(`Admin getVehicles алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// МАШИН НЭМЭХ (Гараар)
// POST /api/admin/vehicles
// ─────────────────────────────────────────
exports.createVehicle = async (req, res) => {
  try {
    const {
      title, brand, model, badge, year,
      price, wonToMnt, extraCosts,
      mileage, fuelType, transmission, engineSize,
      bodyType, color, location, description,
      features, history, adminNote, status,
    } = req.body;

    // Заавал талбарууд
    if (!brand || !model || !year || !price) {
      return res.status(400).json({
        success: false,
        message: 'Брэнд, загвар, он, үнэ заавал байна',
      });
    }

    // Давхардалгүй ID үүсгэх
    const encarId = `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const titleStr = title || `${brand} ${model} ${badge || ''} ${year}`.trim();

    // Зурагнууд (upload хийсэн байвал)
    let images = [];
    if (req.files?.length > 0) {
      images = req.files.map((f, i) => ({
        url:       `/uploads/${f.filename}`,
        alt:       `${titleStr} - Зураг ${i + 1}`,
        isPrimary: i === 0,
        isLocal:   true,
        filename:  f.filename,
      }));
    }

    // Extra costs parse
    let parsedExtraCosts = [];
    if (typeof extraCosts === 'string') {
      try { parsedExtraCosts = JSON.parse(extraCosts); } catch {}
    } else if (Array.isArray(extraCosts)) {
      parsedExtraCosts = extraCosts;
    }

    const vehicle = await Vehicle.create({
      encarId,
      title:        titleStr,
      brand,
      model,
      badge,
      year:         parseInt(year),
      price:        parseInt(price),
      wonToMnt:     parseFloat(wonToMnt) || 0,
      extraCosts:   parsedExtraCosts,
      mileage:      parseInt(mileage) || 0,
      fuelType,
      transmission,
      engineSize,
      bodyType,
      color,
      location,
      description,
      features:     typeof features === 'string' ? features.split(',').map(f => f.trim()).filter(Boolean) : (features || []),
      history: {
        accidents:      parseInt(history?.accidents) || 0,
        owners:         parseInt(history?.owners)    || 1,
        serviceRecords: history?.serviceRecords === 'true' || history?.serviceRecords === true,
      },
      adminNote,
      status:       status || 'active',
      isManual:     true,
      images,
      thumbnailUrl: images[0]?.url || null,
    });

    logger.vehicle.created(vehicle.title, vehicle._id);

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    logger.error(`Машин нэмэхэд алдаа: ${error.message}`);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Давхардсан ID байна' });
    }
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// МАШИН ЗАСАХ
// PUT /api/admin/vehicles/:id
// ─────────────────────────────────────────
exports.updateVehicle = async (req, res) => {
  try {
    const {
      title, brand, model, badge, year,
      price, wonToMnt, extraCosts,
      mileage, fuelType, transmission, engineSize,
      bodyType, color, location, description,
      features, history, adminNote, status,
    } = req.body;

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Зурагнууд
    let newImages = [...(vehicle.images || [])];
    if (req.files?.length > 0) {
      const uploaded = req.files.map((f, i) => ({
        url:       `/uploads/${f.filename}`,
        alt:       `${vehicle.title} - Зураг`,
        isPrimary: newImages.length === 0 && i === 0,
        isLocal:   true,
        filename:  f.filename,
      }));
      newImages = [...newImages, ...uploaded];
    }

    // Extra costs parse
    let parsedExtraCosts = vehicle.extraCosts;
    if (extraCosts !== undefined) {
      if (typeof extraCosts === 'string') {
        try { parsedExtraCosts = JSON.parse(extraCosts); } catch {}
      } else if (Array.isArray(extraCosts)) {
        parsedExtraCosts = extraCosts;
      }
    }

    const updateData = {
      title:        title        || vehicle.title,
      brand:        brand        || vehicle.brand,
      model:        model        || vehicle.model,
      badge:        badge        !== undefined ? badge        : vehicle.badge,
      year:         year         ? parseInt(year)         : vehicle.year,
      price:        price        ? parseInt(price)        : vehicle.price,
      wonToMnt:     wonToMnt     ? parseFloat(wonToMnt)   : vehicle.wonToMnt,
      extraCosts:   parsedExtraCosts,
      mileage:      mileage      ? parseInt(mileage)      : vehicle.mileage,
      fuelType:     fuelType     || vehicle.fuelType,
      transmission: transmission || vehicle.transmission,
      engineSize:   engineSize   || vehicle.engineSize,
      bodyType:     bodyType     || vehicle.bodyType,
      color:        color        || vehicle.color,
      location:     location     || vehicle.location,
      description:  description  !== undefined ? description : vehicle.description,
      features:     features
        ? (typeof features === 'string' ? features.split(',').map(f => f.trim()).filter(Boolean) : features)
        : vehicle.features,
      history: {
        accidents:      history?.accidents      !== undefined ? parseInt(history.accidents)      : vehicle.history?.accidents,
        owners:         history?.owners         !== undefined ? parseInt(history.owners)         : vehicle.history?.owners,
        serviceRecords: history?.serviceRecords !== undefined ? (history.serviceRecords === 'true' || history.serviceRecords === true) : vehicle.history?.serviceRecords,
      },
      adminNote:    adminNote    !== undefined ? adminNote : vehicle.adminNote,
      status:       status       || vehicle.status,
      images:       newImages,
      thumbnailUrl: newImages[0]?.url || vehicle.thumbnailUrl,
    };

    // MNT тооцоолол
    const wRate   = updateData.wonToMnt || 0;
    const priceW  = updateData.price || 0;
    updateData.basePriceMnt  = Math.round(priceW * wRate);
    const extraTotal = parsedExtraCosts.reduce((s, c) => s + (c.amount || 0), 0);
    updateData.totalPriceMnt = updateData.basePriceMnt + extraTotal;

    const updated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.vehicle.updated(updated.title, updated._id);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`Машин засахад алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// МАШИН УСТГАХ
// DELETE /api/admin/vehicles/:id
// ─────────────────────────────────────────
exports.deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Локал зурагнуудыг устгах
    for (const img of vehicle.images || []) {
      if (img.isLocal && img.filename) {
        const filePath = path.join(process.cwd(), 'uploads', img.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.debug(`Зураг устгагдлаа: ${img.filename}`);
        }
      }
    }

    await vehicle.deleteOne();
    logger.vehicle.deleted(vehicle.title, vehicle._id);

    res.json({ success: true, message: 'Машин амжилттай устгагдлаа' });
  } catch (error) {
    logger.error(`Машин устгахад алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// ЗУРАГ УСТГАХ (нэг зураг)
// DELETE /api/admin/vehicles/:id/images/:imgIndex
// ─────────────────────────────────────────
exports.deleteImage = async (req, res) => {
  try {
    const vehicle  = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });

    const idx = parseInt(req.params.imgIndex);
    const img = vehicle.images?.[idx];
    if (!img) return res.status(404).json({ success: false, message: 'Зураг олдсонгүй' });

    // Файл устгах
    if (img.isLocal && img.filename) {
      const filePath = path.join(process.cwd(), 'uploads', img.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    vehicle.images.splice(idx, 1);
    // Эхний зургийг primary болгох
    if (vehicle.images.length > 0) {
      vehicle.images[0].isPrimary = true;
      vehicle.thumbnailUrl = vehicle.images[0].url;
    } else {
      vehicle.thumbnailUrl = null;
    }

    await vehicle.save();
    res.json({ success: true, data: vehicle });
  } catch (error) {
    logger.error(`Зураг устгахад алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// MNT RATE + EXTRA COSTS ШИНЭЧЛЭХ
// PUT /api/admin/vehicles/:id/pricing
// ─────────────────────────────────────────
exports.updatePricing = async (req, res) => {
  try {
    const { wonToMnt, extraCosts } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });

    const rate  = parseFloat(wonToMnt) || vehicle.wonToMnt || 0;
    const costs = Array.isArray(extraCosts) ? extraCosts : vehicle.extraCosts;

    const baseMnt   = Math.round(vehicle.price * rate);
    const extraSum  = costs.reduce((s, c) => s + (c.amount || 0), 0);
    const totalMnt  = baseMnt + extraSum;

    await Vehicle.findByIdAndUpdate(vehicle._id, {
      wonToMnt,
      extraCosts: costs,
      basePriceMnt:  baseMnt,
      totalPriceMnt: totalMnt,
    });

    logger.info(`Үнийн тооцоолол шинэчлэгдлээ — ${vehicle.title}: ${totalMnt.toLocaleString()}₮`);

    res.json({
      success: true,
      data: {
        wonToMnt: rate,
        basePriceMnt:  baseMnt,
        extraCosts:    costs,
        totalPriceMnt: totalMnt,
      },
    });
  } catch (error) {
    logger.error(`Pricing update алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// БҮХ МАШИНЫ ГЛОБАЛ WON→MNT RATE ШИНЭЧЛЭХ
// POST /api/admin/pricing/global
// ─────────────────────────────────────────
exports.updateGlobalRate = async (req, res) => {
  try {
    const { wonToMnt } = req.body;
    const rate = parseFloat(wonToMnt);

    if (!rate || rate <= 0) {
      return res.status(400).json({ success: false, message: 'Хүчинтэй rate оруулна уу' });
    }

    // Бүх active машинуудыг шинэчлэх
    const vehicles = await Vehicle.find({ status: 'active' });
    let updated = 0;

    for (const v of vehicles) {
      const baseMnt  = Math.round(v.price * rate);
      const extraSum = (v.extraCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
      await Vehicle.findByIdAndUpdate(v._id, {
        wonToMnt:      rate,
        basePriceMnt:  baseMnt,
        totalPriceMnt: baseMnt + extraSum,
      });
      updated++;
    }

    logger.info(`Глобал rate шинэчлэгдлээ: 1 ₩ = ${rate} ₮ — ${updated} машин шинэчлэгдлээ`);

    res.json({
      success: true,
      message: `${updated} машины үнэ шинэчлэгдлээ (1 ₩ = ${rate} ₮)`,
      updated,
    });
  } catch (error) {
    logger.error(`Global rate update алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// СТАТИСТИК
// GET /api/admin/stats
// ─────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, active, sold, manual, recentSync] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'active' }),
      Vehicle.countDocuments({ status: 'sold' }),
      Vehicle.countDocuments({ isManual: true }),
      Vehicle.findOne({ isManual: false }).sort('-lastSyncedAt').select('lastSyncedAt').lean(),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        sold,
        manual,
        lastSync: recentSync?.lastSyncedAt || null,
      },
    });
  } catch (error) {
    logger.error(`Admin stats алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

// ─────────────────────────────────────────
// ADMIN НЭМЭХ (Анхны setup)
// POST /api/admin/setup
// ─────────────────────────────────────────
exports.setup = async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return res.status(403).json({
        success: false,
        message: 'Admin аль хэдийн тохируулагдсан байна',
      });
    }

    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username болон password оруулна уу',
      });
    }

    const admin = await Admin.create({
      username: username.toLowerCase(),
      password,
      name:     name || 'Admin',
      isSuper:  true,
    });

    logger.info(`Анхны Admin үүсгэгдлээ: "${admin.username}"`);

    const token = signToken(admin._id);
    res.status(201).json({
      success: true,
      message: 'Admin амжилттай үүсгэгдлээ',
      token,
    });
  } catch (error) {
    logger.error(`Setup алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};