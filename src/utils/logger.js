const winston = require('winston');
const path = require('path');

// ══════════════════════════════════════════
// CUSTOM LOG FORMAT - Junior dev friendly
// ══════════════════════════════════════════

const ICONS = {
  error:   '❌',
  warn:    '⚠️ ',
  info:    '✅',
  debug:   '🔍',
  http:    '🌐',
  verbose: '📋',
};

const COLORS = {
  reset:   '\x1b[0m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bold:    '\x1b[1m',
};

const levelColors = {
  error:   COLORS.red,
  warn:    COLORS.yellow,
  info:    COLORS.green,
  debug:   COLORS.cyan,
  http:    COLORS.blue,
  verbose: COLORS.gray,
};

// Console format - маш тодорхой
const consoleFormat = winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
  const icon    = ICONS[level]    || '📌';
  const color   = levelColors[level] || COLORS.white;
  const reset   = COLORS.reset;
  const gray    = COLORS.gray;
  const bold    = COLORS.bold;

  // Timestamp
  const time = `${gray}[${timestamp}]${reset}`;

  // Level badge
  const levelBadge = `${color}${bold}[${level.toUpperCase().padEnd(5)}]${reset}`;

  // Message
  let msg = `${color}${message}${reset}`;

  // Stack trace (алдааны дэлгэрэнгүй)
  let stackTrace = '';
  if (stack) {
    stackTrace = `\n${COLORS.red}Stack Trace:\n${stack}${reset}`;
  }

  // Extra metadata
  let metaStr = '';
  if (Object.keys(meta).length > 0) {
    metaStr = `\n${gray}  └─ ${JSON.stringify(meta, null, 2)}${reset}`;
  }

  return `${time} ${icon} ${levelBadge} ${msg}${stackTrace}${metaStr}`;
});

// File format - цэвэр JSON
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ══════════════════════════════════════════
// LOGGER ҮҮСГЭХ
// ══════════════════════════════════════════

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  transports: [
    // Console - өнгөтэй, тодорхой
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        consoleFormat
      ),
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// ══════════════════════════════════════════
// HELPER FUNCTIONS - тодорхой мессежүүд
// ══════════════════════════════════════════

// Server мессежүүд
logger.server = {
  starting: (port) => {
    logger.info(`═══════════════════════════════════════════════`);
    logger.info(`🚀 SERVER ЭХЭЛЛЭЭ`);
    logger.info(`   📡 Port    : http://localhost:${port}`);
    logger.info(`   🌍 Orчин   : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   📁 API URL : http://localhost:${port}/api`);
    logger.info(`   🏥 Health  : http://localhost:${port}/health`);
    logger.info(`   🔑 Admin   : http://localhost:${port}/api/admin`);
    logger.info(`═══════════════════════════════════════════════`);
  },
  
  stopping: (signal) => {
    logger.warn(`Server зогсож байна... (Signal: ${signal})`);
  },
};

// MongoDB мессежүүд  
logger.db = {
  connecting: (uri) => {
    const safeUri = uri?.replace(/:([^:@]{1,})@/, ':****@') || 'unknown';
    logger.info(`MongoDB холбогдож байна... URI: ${safeUri}`);
  },
  
  connected: (host, dbName) => {
    logger.info(`MongoDB амжилттай холбогдлоо!`);
    logger.info(`   🏠 Host     : ${host}`);
    logger.info(`   🗄️  Database : ${dbName}`);
  },
  
  disconnected: () => {
    logger.warn(`MongoDB салгагдлаа! Дахин холбогдохыг оролдоно...`);
  },
  
  reconnected: () => {
    logger.info(`MongoDB дахин холбогдлоо ✓`);
  },
  
  error: (err) => {
    logger.error(`MongoDB холболтын АЛДАА: ${err.message}`);
    logger.error(`   Шийдэл: .env файлд MONGODB_URI зөв бичигдсэн эсэхийг шалгаарай`);
    logger.error(`   Жишээ : MONGODB_URI=mongodb://localhost:27017/smcar`);
  },
};

// Sync мессежүүд
logger.sync = {
  start: (type, batchSize) => {
    logger.info(`═══════════ SYNC ЭХЭЛЛЭЭ [${type.toUpperCase()}] ═══════════`);
    logger.info(`   Batch хэмжээ: ${batchSize} машин`);
  },
  
  progress: (fetched, total) => {
    const pct = total > 0 ? Math.round((fetched / total) * 100) : 0;
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    logger.info(`   [${bar}] ${pct}% — ${fetched}/${total} машин татагдлаа`);
  },
  
  vehicleAdded: (title, encarId) => {
    logger.debug(`   🆕 Шинэ машин: ${title} (ID: ${encarId})`);
  },
  
  vehicleUpdated: (title) => {
    logger.debug(`   ♻️  Шинэчлэгдсэн: ${title}`);
  },
  
  vehicleSold: (count) => {
    logger.info(`   🔴 ${count} машин зарагдсан болгогдлоо`);
  },
  
  complete: (stats, durationMs) => {
    const sec = (durationMs / 1000).toFixed(1);
    logger.info(`═══════════ SYNC ДУУСЛАА (${sec}s) ═══════════`);
    logger.info(`   📦 Нийт татагдсан : ${stats.totalFetched}`);
    logger.info(`   🆕 Шинэ машин     : ${stats.newVehicles}`);
    logger.info(`   ♻️  Шинэчлэгдсэн  : ${stats.updatedVehicles}`);
    logger.info(`   🔴 Зарагдсан      : ${stats.removedVehicles}`);
    logger.info(`   ❌ Алдаа          : ${stats.errors}`);
    logger.info(`═══════════════════════════════════════════════`);
  },
  
  failed: (err) => {
    logger.error(`SYNC АМЖИЛТГҮЙ БОЛОО!`);
    logger.error(`   Шалтгаан: ${err.message}`);
    if (err.stack) logger.error(`   Stack: ${err.stack}`);
  },
  
  alreadyRunning: () => {
    logger.warn(`Sync аль хэдийн ажиллаж байна. Шинэ sync эхлүүлэхгүй.`);
  },
};

// API Request мессежүүд
logger.api = {
  request: (method, url, params) => {
    logger.debug(`→ ${method} ${url} ${params ? JSON.stringify(params) : ''}`);
  },
  
  response: (status, url, durationMs) => {
    const color = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    logger.debug(`← ${color} ${status} ${url} (${durationMs}ms)`);
  },
  
  error: (status, url, message) => {
    logger.error(`API Алдаа [${status}] ${url}: ${message}`);
  },
};

// Auth мессежүүд
logger.auth = {
  loginSuccess: (username, ip) => {
    logger.info(`Admin нэвтэрлээ: "${username}" (IP: ${ip})`);
  },
  
  loginFailed: (username, ip, reason) => {
    logger.warn(`Нэвтрэлт амжилтгүй: "${username}" (IP: ${ip}) — ${reason}`);
  },
  
  tokenInvalid: (ip) => {
    logger.warn(`Хүчингүй token ирлээ (IP: ${ip})`);
  },
};

// Vehicle CRUD мессежүүд
logger.vehicle = {
  created: (title, id) => {
    logger.info(`Машин нэмэгдлээ: "${title}" (ID: ${id})`);
  },
  
  updated: (title, id) => {
    logger.info(`Машин засагдлаа: "${title}" (ID: ${id})`);
  },
  
  deleted: (title, id) => {
    logger.warn(`Машин устгагдлаа: "${title}" (ID: ${id})`);
  },
  
  imageUploaded: (vehicleId, count) => {
    logger.info(`${count} зураг нэмэгдлээ — Машин ID: ${vehicleId}`);
  },
};

module.exports = logger;