require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const vehicleRoutes = require('./routes/vehicles');
const marketRoutes = require('./routes/market');

// Sync service
const syncService = require('./services/syncService');

// ─────────────────────────────────────────
// APP ҮҮСГЭХ
// ─────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────

// Аюулгүй байдал
app.use(helmet());

// CORS - Frontend-д зөвшөөрөх
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:8081', // React Native
    'exp://localhost:8081',  // Expo
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Шахалт
app.use(compression());

// Логгинг
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// JSON parse
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Хэт олон хүсэлт илгээлээ. 15 минутын дараа дахин оролдоно уу.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/market', marketRoutes);

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    syncRunning: syncService.isRunning,
  });
});

// API мэдээлэл
app.get('/api', (req, res) => {
  res.json({
    success: true,
    name: 'Car Marketplace API',
    version: '1.0.0',
    endpoints: {
      vehicles: '/api/vehicles',
      market: '/api/market',
      health: '/health',
    },
  });
});

// ─────────────────────────────────────────
// АЛДАА БОЛОВСРУУЛАГЧ
// ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────
// СЕРВЕР ЭХЛҮҮЛЭХ
// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // MongoDB холбох
    await connectDB();

    // Сервер эхлүүлэх
    app.listen(PORT, () => {
      logger.info('═══════════════════════════════════════');
      logger.info(`🚀 Car Marketplace сервер ажиллаж байна`);
      logger.info(`📡 Порт: ${PORT}`);
      logger.info(`🌍 Орчин: ${process.env.NODE_ENV}`);
      logger.info(`🔗 URL: http://localhost:${PORT}`);
      logger.info('═══════════════════════════════════════');

      // Автомат синк эхлүүлэх
      if (process.env.NODE_ENV !== 'test') {
        syncService.startAutoSync();
      }
    });

  } catch (error) {
    logger.error(`❌ Сервер эхлүүлэхэд алдаа: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('⛔ SIGTERM хүлээн авлаа. Сервер зогсож байна...');
  syncService.stopAutoSync();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('⛔ SIGINT хүлээн авлаа. Сервер зогсож байна...');
  syncService.stopAutoSync();
  process.exit(0);
});

startServer();

module.exports = app;
