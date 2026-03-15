const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    logger.error('MONGODB_URI тохируулагдаагүй байна!');
    logger.error('   → .env файлд MONGODB_URI=mongodb://localhost:27017/smcar гэж нэмнэ үү');
    process.exit(1);
  }

  logger.db.connecting(uri);

  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 5000,
  };

  try {
    const conn = await mongoose.connect(uri, options);
    const { host, port, name } = conn.connection;
    logger.db.connected(`${host}:${port}`, name);

    // Event listeners
    mongoose.connection.on('disconnected', () => {
      logger.db.disconnected();
    });

    mongoose.connection.on('reconnected', () => {
      logger.db.reconnected();
    });

    mongoose.connection.on('error', (err) => {
      logger.db.error(err);
    });

    mongoose.connection.on('close', () => {
      logger.warn('MongoDB холболт хаагдлаа');
    });

    return conn;

  } catch (error) {
    logger.db.error(error);
    
    // Нарийвчилсан алдааны тайлбар
    if (error.message.includes('ECONNREFUSED')) {
      logger.error('═══════════════════════════════════════════════');
      logger.error('MongoDB ажиллахгүй байна! (Connection Refused)');
      logger.error('   Шийдэл 1: mongod --dbpath /data/db командыг ажиллуулна');
      logger.error('   Шийдэл 2: brew services start mongodb-community (Mac)');
      logger.error('   Шийдэл 3: docker run -d -p 27017:27017 mongo:latest');
      logger.error('═══════════════════════════════════════════════');
    } else if (error.message.includes('Authentication failed')) {
      logger.error('MongoDB нэвтрэх нэр/нууц үг буруу байна!');
      logger.error('   → .env файлийн MONGODB_URI дэх username/password-ийг шалгаарай');
    } else if (error.message.includes('timed out')) {
      logger.error('MongoDB холбогдох хугацаа дууслаа! (Timeout)');
      logger.error('   → MongoDB ажиллаж байгаа эсэхийг шалгаарай');
      logger.error(`   → URI: ${uri?.replace(/:([^:@]{1,})@/, ':****@')}`);
    }
    
    process.exit(1);
  }
};

// Graceful disconnect
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB холболт цэвэрхэн хаагдлаа');
  } catch (err) {
    logger.error(`MongoDB хаахад алдаа: ${err.message}`);
  }
};

module.exports = { connectDB, disconnectDB };