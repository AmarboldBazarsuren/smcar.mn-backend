const Vehicle = require('../models/Vehicle');
const logger  = require('../utils/logger');

// ─────────────────────────────────────────
// DASHBOARD СТАТИСТИК
// GET /api/admin/stats
// ─────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, active, sold, manual, recentSync] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'active' }),
      Vehicle.countDocuments({ status: 'sold' }),
      Vehicle.countDocuments({ isManual: true }),
      Vehicle.findOne({ isManual: false })
        .sort('-lastSyncedAt')
        .select('lastSyncedAt')
        .lean(),
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