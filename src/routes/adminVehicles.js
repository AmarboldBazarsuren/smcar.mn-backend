const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  deleteImage,
} = require('../controllers/adminVehicleController');
const { protect } = require('../middleware/auth');

// ─────────────────────────────────────────
// MULTER ТОХИРГОО
// ─────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
  allowed.includes(ext)
    ? cb(null, true)
    : cb(new Error(`Зөвшөөрөгдсөн өргөтгөлүүд: ${allowed.join(', ')}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
});

// ─────────────────────────────────────────
// ROUTES (бүгд protect шаарддаг)
// ─────────────────────────────────────────

// GET    /api/admin/vehicles                        — Жагсаалт
router.get('/',    protect, getVehicles);

// POST   /api/admin/vehicles                        — Шинэ машин нэмэх
router.post('/',   protect, upload.array('images', 20), createVehicle);

// PUT    /api/admin/vehicles/:id                    — Засах
router.put('/:id', protect, upload.array('images', 20), updateVehicle);

// DELETE /api/admin/vehicles/:id                    — Устгах
router.delete('/:id', protect, deleteVehicle);

// DELETE /api/admin/vehicles/:id/images/:imgIndex   — Зураг устгах
router.delete('/:id/images/:imgIndex', protect, deleteImage);

module.exports = router;