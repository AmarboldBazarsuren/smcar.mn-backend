const logger = require('../utils/logger');

// 404 Handler
const notFound = (req, res, next) => {
  const error = new Error(`Хаяг олдсонгүй: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Глобал алдаа боловсруулагч
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  logger.error(`[${statusCode}] ${req.method} ${req.path} - ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Сервер алдаа гарлаа',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = { notFound, errorHandler };
