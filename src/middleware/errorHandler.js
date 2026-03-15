const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  const err = new Error(`Хаяг олдсонгүй: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${req.method} ${req.path}`);
    logger.error(`   Мессеж: ${err.message}`);
    if (process.env.NODE_ENV === 'development' && err.stack) {
      logger.error(`   Stack:\n${err.stack}`);
    }
  } else if (statusCode >= 400) {
    logger.warn(`[${statusCode}] ${req.method} ${req.path} — ${err.message}`);
  }

  // Multer алдаа
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Файлын хэмжээ хэтэрлээ (max 10MB)',
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Хэт олон файл (max 20)',
    });
  }

  // MongoDB дугаарлалтын алдаа
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(400).json({
      success: false,
      message: `${field} давхардсан утга байна`,
    });
  }

  // Mongoose validation алдаа
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('; '),
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Серверийн алдаа гарлаа',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };