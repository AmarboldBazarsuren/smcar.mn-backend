const jwt    = require('jsonwebtoken');
const Admin  = require('../models/Admin');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// JWT ШАЛГАХ MIDDLEWARE
// ─────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Header-аас token авах
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Cookie-аас авах (optional)
    else if (req.cookies?.adminToken) {
      token = req.cookies.adminToken;
    }

    if (!token) {
      logger.auth.tokenInvalid(req.ip);
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх шаардлагатай. Token байхгүй байна.',
      });
    }

    // Token шалгах
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session дууссан. Дахин нэвтэрнэ үү.',
        });
      }
      logger.auth.tokenInvalid(req.ip);
      return res.status(401).json({
        success: false,
        message: 'Token хүчингүй байна.',
      });
    }

    // Admin олдсон эсэх
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin олдсонгүй.',
      });
    }

    req.admin = admin;
    next();

  } catch (error) {
    logger.error(`Auth middleware алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Серверийн алдаа' });
  }
};

module.exports = { protect };