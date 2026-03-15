const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const adminController = require('../controllers/adminController');
const { protect }     = require('../middleware/auth');

// ─────────────────────────────────────────
// MULTER — зураг upload
// ─────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Зургийн өргөтгөл зөвшөөрөгдөхгүй байна. Зөвшөөрөгдсөн: ${allowed.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  10 * 1024 * 1024, // 10MB нэг файл
    files:     20,               // Нэг удаад 20 зураг
  },
});

// ─────────────────────────────────────────
// PUBLIC ROUTES (auth шаардахгүй)
// ─────────────────────────────────────────

// POST /api/admin/login        — Нэвтрэх
router.post('/login', adminController.login);

// POST /api/admin/setup        — Анхны admin үүсгэх (нэг л удаа)
router.post('/setup', adminController.setup);

// ─────────────────────────────────────────
// PROTECTED ROUTES (token шаардана)
// ─────────────────────────────────────────

// GET  /api/admin/me           — Өөрийн мэдээлэл
router.get('/me', protect, adminController.getMe);

// GET  /api/admin/stats        — Dashboard статистик
router.get('/stats', protect, adminController.getStats);

// POST /api/admin/pricing/global — Бүх машины rate шинэчлэх
router.post('/pricing/global', protect, adminController.updateGlobalRate);

// ── Машин CRUD ──
// GET    /api/admin/vehicles           — Жагсаалт
router.get('/vehicles', protect, adminController.getVehicles);

// POST   /api/admin/vehicles           — Шинэ машин нэмэх
router.post('/vehicles', protect, upload.array('images', 20), adminController.createVehicle);

// PUT    /api/admin/vehicles/:id       — Засах
router.put('/vehicles/:id', protect, upload.array('images', 20), adminController.updateVehicle);

// DELETE /api/admin/vehicles/:id       — Устгах
router.delete('/vehicles/:id', protect, adminController.deleteVehicle);

// PUT    /api/admin/vehicles/:id/pricing — MNT rate & extra costs
router.put('/vehicles/:id/pricing', protect, adminController.updatePricing);

// DELETE /api/admin/vehicles/:id/images/:imgIndex — Зураг устгах
router.delete('/vehicles/:id/images/:imgIndex', protect, adminController.deleteImage);

module.exports = router;