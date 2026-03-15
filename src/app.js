require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const { connectDB, disconnectDB } = require('./config/database');
const { notFound, errorHandler }  = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const vehicleRoutes = require('./routes/vehicles');
const marketRoutes  = require('./routes/market');
const adminRoutes   = require('./routes/admin');

// Sync service
const syncService = require('./services/syncService');

// ─────────────────────────────────────────
// UPLOADS FOLDER
// ─────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info(`Uploads folder үүсгэгдлээ: ${uploadDir}`);
}

// ─────────────────────────────────────────
// APP ҮҮСГЭХ
// ─────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────

// Аюулгүй байдал (uploads-д зориулж helmet-ийг тохируулах)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // origin байхгүй бол (Postman, same-origin) зөвшөөрөх
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS хориглогдлоо: ${origin}`);
      callback(new Error('CORS policy-д тохирохгүй байна'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Шахалт
app.use(compression());

// HTTP логгинг (Morgan → Winston)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => {
      const msg = message.trim();
      // 4xx, 5xx алдааг warn/error-ээр харуулах
      if (msg.includes(' 4') || msg.includes(' 5')) {
        logger.warn(`HTTP ${msg}`);
      } else {
        logger.debug(`HTTP ${msg}`);
      }
    },
  },
}));

// JSON parse
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─────────────────────────────────────────
// STATIC FILES — Зурагнуудад хандах
// ─────────────────────────────────────────
app.use('/uploads', express.static(uploadDir, {
  maxAge: '7d',
  etag:   true,
}));

logger.info(`Static files: /uploads → ${uploadDir}`);

// ─────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message:  { success: false, message: 'Хэт олон хүсэлт. 15 минутын дараа дахин оролдоно уу.' },
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit хэтэрлээ — IP: ${req.ip} | URL: ${req.url}`);
    res.status(429).json(options.message);
  },
});

// Admin-д илүү хатуу rate limit
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { success: false, message: 'Admin: хэт олон хүсэлт.' },
});

app.use('/api/', generalLimiter);
app.use('/api/admin/', adminLimiter);

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/market',   marketRoutes);
app.use('/api/admin',    adminRoutes);

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState  = ['disconnected','connected','connecting','disconnecting'];
  
  res.json({
    success:     true,
    status:      'OK',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database:    dbState[mongoose.connection.readyState] || 'unknown',
    syncRunning: syncService.isRunning,
    uptime:      `${Math.floor(process.uptime())}s`,
    memory:      `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    name:    'SMCar.mn API',
    version: '2.0.0',
    endpoints: {
      vehicles: '/api/vehicles',
      market:   '/api/market',
      admin:    '/api/admin',
      uploads:  '/uploads/:filename',
      health:   '/health',
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
const PORT = parseInt(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    // Env шалгах
    const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
    const missingEnv  = requiredEnv.filter(k => !process.env[k]);
    if (missingEnv.length > 0) {
      logger.error(`Шаардлагатай env variable-ууд дутуу байна:`);
      missingEnv.forEach(k => logger.error(`   → ${k} байхгүй байна`));
      logger.error(`   .env файлийг шалгаарай (.env.example-ийг харна уу)`);
      process.exit(1);
    }

    // MongoDB холбох
    await connectDB();

    // Сервер эхлүүлэх
    const server = app.listen(PORT, () => {
      logger.server.starting(PORT);

      // Автомат синк эхлүүлэх
      if (process.env.NODE_ENV !== 'test') {
        syncService.startAutoSync();
      }
    });

    // Unhandled promise rejection
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Promise Rejection: ${err.message}`);
      logger.error(`Stack: ${err.stack}`);
      server.close(() => process.exit(1));
    });

    return server;

  } catch (error) {
    logger.error(`Сервер эхлүүлэхэд алдаа: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.server.stopping(signal);
  syncService.stopAutoSync();
  await disconnectDB();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

startServer();

module.exports = app;