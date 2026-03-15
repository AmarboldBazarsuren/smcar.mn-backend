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
    // Өдөрт 1 удаа — өглөө 3:00 цагт
    const cronExpression = process.env.SYNC_CRON || '0 3 * * *';
    logger.info(`Автомат sync: өдөрт 1 удаа — cron: "${cronExpression}"`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      logger.info('Өдрийн автомат sync эхэллээ...');
      await this.runSync('auto');
    });

    // Сервер эхлэхэд өнөөдөр sync хийгдсэн эсэхийг шалгана
    setTimeout(() => this._initialSyncIfNeeded(), 10000);
  }

  async _initialSyncIfNeeded() {
    try {
      const lastSync = await SyncLog.findOne({ status: 'success' }).sort({ completedAt: -1 }).lean();
      if (!lastSync) {
        logger.info('Өмнө sync хийгдэж байгаагүй. Анхны sync эхэлж байна...');
        await this.runSync('initial');
        return;
      }
      const lastDate = new Date(lastSync.completedAt);
      const today    = new Date();
      const isSameDay =
        lastDate.getFullYear() === today.getFullYear() &&
        lastDate.getMonth()    === today.getMonth()    &&
        lastDate.getDate()     === today.getDate();

      if (!isSameDay) {
        logger.info(`Өнөөдөр sync хийгдээгүй (сүүлийнх: ${lastDate.toLocaleDateString()}). Sync эхэлж байна...`);
        await this.runSync('initial');
      } else {
        logger.info(`Өнөөдрийн sync хийгдсэн (${lastDate.toLocaleTimeString()}). Алгасав.`);
      }
    } catch (err) {
      logger.error(`Initial sync check алдаа: ${err.message}`);
    }
  }

  stopAutoSync() {
    if (this.cronJob) { this.cronJob.destroy(); this.cronJob = null; }
  }

  async runSync(type = 'manual') {
    if (this.isRunning) { logger.sync.alreadyRunning(); return null; }

    this.isRunning = true;
    const startTime = Date.now();
    const syncLog = await SyncLog.create({ type, status: 'running', startedAt: new Date() });
    const batchSize = parseInt(process.env.SYNC_BATCH_SIZE) || 100;
    logger.sync.start(type, batchSize);

    const stats = { totalFetched: 0, newVehicles: 0, updatedVehicles: 0, removedVehicles: 0, errors: 0 };

    try {
      const apiVehicles = await encarService.fetchAllVehicles(batchSize);
      stats.totalFetched = apiVehicles.length;

      if (apiVehicles.length === 0) {
        logger.warn('Encar API хоосон хариу. Өгөгдлийг хэвээр үлдээнэ.');
        await SyncLog.findByIdAndUpdate(syncLog._id, { status: 'success', completedAt: new Date(), stats, duration: Date.now() - startTime });
        this.isRunning = false;
        return stats;
      }

      const existingDocs = await Vehicle.find({ isManual: { $ne: true } }, 'encarId').lean();
      const existingMap  = new Map(existingDocs.map(v => [v.encarId, v]));
      const apiIds       = new Set(apiVehicles.map(v => String(v.Id || v.id)));

      for (let i = 0; i < apiVehicles.length; i++) {
        if (i > 0 && i % 200 === 0) logger.sync.progress(i, apiVehicles.length);
        try {
          const vehicleData = encarService.transformVehicle(apiVehicles[i]);
          if (!vehicleData.encarId) { stats.errors++; continue; }

          if (existingMap.has(vehicleData.encarId)) {
            await Vehicle.findOneAndUpdate(
              { encarId: vehicleData.encarId },
              { $set: { ...vehicleData, status: 'active', lastSyncedAt: new Date() } }
            );
            stats.updatedVehicles++;
          } else {
            await Vehicle.create({ ...vehicleData, status: 'active', lastSyncedAt: new Date() });
            stats.newVehicles++;
          }
        } catch (err) {
          if (err.code === 11000) stats.updatedVehicles++;
          else { logger.error(`Машин хадгалахад алдаа: ${err.message}`); stats.errors++; }
        }
      }

      // 7+ хоног байхгүй → sold
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const removedIds   = [...existingMap.keys()].filter(id => !apiIds.has(id));
      if (removedIds.length > 0) {
        const r = await Vehicle.updateMany(
          { encarId: { $in: removedIds }, isManual: { $ne: true }, lastSyncedAt: { $lt: sevenDaysAgo } },
          { $set: { status: 'sold' } }
        );
        stats.removedVehicles = r.modifiedCount || 0;
      }

      const duration = Date.now() - startTime;
      await SyncLog.findByIdAndUpdate(syncLog._id, { status: 'success', completedAt: new Date(), stats, duration });
      logger.sync.complete(stats, duration);

    } catch (error) {
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        status: 'failed', completedAt: new Date(), stats,
        duration: Date.now() - startTime, errorMessage: error.message,
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