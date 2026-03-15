const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// ─────────────────────────────────────────
// НЭГ МАШИНЫ MNT RATE + EXTRA COSTS ШИНЭЧЛЭХ
// PUT /api/admin/vehicles/:id/pricing
// ─────────────────────────────────────────
exports.updatePricing = async (req, res) => {
  try {
    const { wonToMnt, extraCosts } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    const rate  = parseFloat(wonToMnt) || vehicle.wonToMnt || 0;
    const costs = Array.isArray(extraCosts) ? extraCosts : vehicle.extraCosts;

    const baseMnt  = Math.round(vehicle.price * rate);
    const extraSum = costs.reduce((s, c) => s + (c.amount || 0), 0);
    const totalMnt = baseMnt + extraSum;

    await Vehicle.findByIdAndUpdate(vehicle._id, {
      wonToMnt,
      extraCosts:    costs,
      basePriceMnt:  baseMnt,
      totalPriceMnt: totalMnt,
    });

    logger.info(`Үнийн тооцоолол шинэчлэгдлээ — ${vehicle.title}: ${totalMnt.toLocaleString()}₮`);

    res.json({
      success: true,
      data: {
        wonToMnt:      rate,
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