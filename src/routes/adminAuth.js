const express  = require('express');
const router   = express.Router();
const { login, getMe, setup } = require('../controllers/adminAuthController');
const { protect } = require('../middleware/auth');

// POST /api/admin/login   — Нэвтрэх
router.post('/login', login);

// POST /api/admin/setup   — Анхны admin үүсгэх (нэг л удаа)
router.post('/setup', setup);

// GET  /api/admin/me      — Өөрийн мэдээлэл
router.get('/me', protect, getMe);

module.exports = router;