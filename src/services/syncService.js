const cron    = require('node-cron');
const Vehicle = require('../models/Vehicle');
const SyncLog = require('../models/SyncLog');
const encarService = require('./encarService');
const logger  = require('../utils/logger');

class SyncService {
  constructor() {
    this.isRunning = false;
    this.cronJob   = null;
  }

  startAutoSync() {
    const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 30;
    const cronExpression  = `*/${intervalMinutes} * * * *`;

    logger.info(`Автомат sync тохируулагдлаа: ${intervalMinutes} минут тутамд`);
    logger.info(`   Cron: "${cronExpression}"`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      logger.info('Автомат sync эхэллээ...');
      await this.runSync('auto');
    });

    // Эхлэхэд нэг удаа ажиллуулах
    logger.info('Анхны sync эхэлж байна (5 секундын дараа)...');
    setTimeout(() => this.runSync('initial'), 5000);
  }

  stopAutoSync() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
      logger.info('Автомат sync зогслоо');
    }
  }

  async runSync(type = 'manual') {
    if (this.isRunning) {
      logger.sync.alreadyRunning();
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    const syncLog = await SyncLog.create({
      type,
      status:    'running',
      startedAt: new Date(),
    });

    const batchSize = parseInt(process.env.SYNC_BATCH_SIZE) || 100;
    logger.sync.start(type, batchSize);

    const stats = {
      totalFetched:    0,
      newVehicles:     0,
      updatedVehicles: 0,
      removedVehicles: 0,
      errors:          0,
    };

    try {
      // ─── Encar-аас татах ───
      logger.info('Encar.com-оос машинуудыг татаж байна...');
      const apiVehicles = await encarService.fetchAllVehicles(batchSize);
      stats.totalFetched = apiVehicles.length;

      if (apiVehicles.length === 0) {
        logger.warn('Encar API-аас хоосон хариу ирлээ. Sync алгасав.');
        await SyncLog.findByIdAndUpdate(syncLog._id, {
          status:       'success',
          completedAt:  new Date(),
          stats,
          duration:     Date.now() - startTime,
        });
        this.isRunning = false;
        return stats;
      }

      logger.info(`${apiVehicles.length} машин татагдлаа. Боловсруулж байна...`);

      // ─── Одоо байгаа ID-уудыг авах ───
      logger.debug('MongoDB-ийн одоо байгаа машинуудын ID-уудыг татаж байна...');
      const existingDocs = await Vehicle.find({ isManual: { $ne: true } }, 'encarId title').lean();
      const existingMap  = new Map(existingDocs.map(v => [v.encarId, v]));
      logger.debug(`MongoDB-д одоо ${existingMap.size} машин байна`);

      const apiIds = new Set(apiVehicles.map(v => String(v.Id || v.id)));

      // ─── Нэг нэгнээр боловсруулах ───
      for (let i = 0; i < apiVehicles.length; i++) {
        const apiVehicle = apiVehicles[i];

        // 50 тутам progress харуулах
        if (i > 0 && i % 50 === 0) {
          logger.sync.progress(i, apiVehicles.length);
        }

        try {
          const vehicleData = encarService.transformVehicle(apiVehicle);
          const existing    = existingMap.get(vehicleData.encarId);

          if (existing) {
            await Vehicle.findOneAndUpdate(
              { encarId: vehicleData.encarId },
              { $set: { ...vehicleData, lastSyncedAt: new Date() } },
              { new: false }
            );
            logger.sync.vehicleUpdated(vehicleData.title);
            stats.updatedVehicles++;
          } else {
            await Vehicle.create({ ...vehicleData, lastSyncedAt: new Date() });
            logger.sync.vehicleAdded(vehicleData.title, vehicleData.encarId);
            stats.newVehicles++;
          }
        } catch (err) {
          logger.error(`Машин боловсруулахад алдаа (${apiVehicle.Id}): ${err.message}`);
          stats.errors++;
        }
      }

      // ─── Зарагдсан машинууд ───
      const removedIds = [...existingMap.keys()].filter(id => !apiIds.has(id));
      if (removedIds.length > 0) {
        await Vehicle.updateMany(
          { encarId: { $in: removedIds }, isManual: { $ne: true } },
          { $set: { status: 'sold' } }
        );
        stats.removedVehicles = removedIds.length;
        logger.sync.vehicleSold(removedIds.length);
      }

      // ─── Амжилттай дуусгах ───
      const duration = Date.now() - startTime;
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        status:      'success',
        completedAt: new Date(),
        stats,
        duration,
      });

      logger.sync.complete(stats, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        status:       'failed',
        completedAt:  new Date(),
        stats,
        duration,
        errorMessage: error.message,
      });

      logger.sync.failed(error);
    } finally {
      this.isRunning = false;
    }

    return stats;
  }

  async getSyncStatus() {
    const lastSync = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
    return { isRunning: this.isRunning, lastSync };
  }

  async getSyncHistory(limit = 20) {
    return SyncLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}

module.exports = new SyncService();