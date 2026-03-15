const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// JWT TOKEN ҮҮСГЭХ
// ─────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

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

    const admin = await Admin.findOne({ username: username.toLowerCase() }).select('+password');

    if (!admin) {
      logger.auth.loginFailed(username, ip, 'Admin олдсонгүй');
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу',
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      logger.auth.loginFailed(username, ip, 'Нууц үг буруу');
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу',
      });
    }

    await Admin.findByIdAndUpdate(admin._id, {
      lastLogin: new Date(),
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
// ӨӨРИЙН МЭДЭЭЛЭЛ
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
// АНХНЫ ADMIN ҮҮСГЭХ
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