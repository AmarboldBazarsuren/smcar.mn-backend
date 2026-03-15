const path    = require('path');
const fs      = require('fs');
const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// ─────────────────────────────────────────
// МАШИНУУДЫН ЖАГСААЛТ
// GET /api/admin/vehicles
// ─────────────────────────────────────────
exports.getVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title:   new RegExp(search, 'i') },
        { brand:   new RegExp(search, 'i') },
        { model:   new RegExp(search, 'i') },
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
          page:       pageNum,
          limit:      limitNum,
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

    if (!brand || !model || !year || !price) {
      return res.status(400).json({
        success: false,
        message: 'Брэнд, загвар, он, үнэ заавал байна',
      });
    }

    const encarId   = `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const titleStr  = title || `${brand} ${model} ${badge || ''} ${year}`.trim();

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
      features:     typeof features === 'string'
        ? features.split(',').map(f => f.trim()).filter(Boolean)
        : (features || []),
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
      features: features
        ? (typeof features === 'string'
            ? features.split(',').map(f => f.trim()).filter(Boolean)
            : features)
        : vehicle.features,
      history: {
        accidents:
          history?.accidents !== undefined
            ? parseInt(history.accidents)
            : vehicle.history?.accidents,
        owners:
          history?.owners !== undefined
            ? parseInt(history.owners)
            : vehicle.history?.owners,
        serviceRecords:
          history?.serviceRecords !== undefined
            ? (history.serviceRecords === 'true' || history.serviceRecords === true)
            : vehicle.history?.serviceRecords,
      },
      adminNote:    adminNote !== undefined ? adminNote : vehicle.adminNote,
      status:       status       || vehicle.status,
      images:       newImages,
      thumbnailUrl: newImages[0]?.url || vehicle.thumbnailUrl,
    };

    // MNT тооцоолол
    const wRate   = updateData.wonToMnt || 0;
    const priceW  = updateData.price    || 0;
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
// НЭГ ЗУРАГ УСТГАХ
// DELETE /api/admin/vehicles/:id/images/:imgIndex
// ─────────────────────────────────────────
exports.deleteImage = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    const idx = parseInt(req.params.imgIndex);
    const img = vehicle.images?.[idx];
    if (!img) {
      return res.status(404).json({ success: false, message: 'Зураг олдсонгүй' });
    }

    if (img.isLocal && img.filename) {
      const filePath = path.join(process.cwd(), 'uploads', img.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    vehicle.images.splice(idx, 1);

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