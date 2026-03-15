const cron = require('node-cron');
const Vehicle = require('../models/Vehicle');
const SyncLog = require('../models/SyncLog');
const encarService = require('./encarService');
const logger = require('../utils/logger');

class SyncService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  // ─────────────────────────────────────────
  // АВТОМАТ СИНК ЭХЛҮҮЛЭХ
  // ─────────────────────────────────────────
  startAutoSync() {
    const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 30;
    
    // Cron expression: жишээ нь 30 минут тутамд = "*/30 * * * *"
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    logger.info(`⏰ Автомат синк эхэллээ. ${intervalMinutes} минут тутамд шинэчлэгдэнэ.`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      logger.info('🔄 Автомат синк эхэллээ...');
      await this.runSync('auto');
    });

    // Эхлэхэд нэг удаа ажиллуулах
    this.runSync('initial');
  }

  // ─────────────────────────────────────────
  // СИНК ЗОГСООХ
  // ─────────────────────────────────────────
  stopAutoSync() {
    if (this.cronJob) {
      this.cronJob.destroy();
      logger.info('⛔ Автомат синк зогслоо');
    }
  }

  // ─────────────────────────────────────────
  // ҮНДСЭН СИНК ФУНКЦ
  // ─────────────────────────────────────────
  async runSync(type = 'manual') {
    // Давхардсан синк-аас сэргийлэх
    if (this.isRunning) {
      logger.warn('⚠️  Синк аль хэдийн ажиллаж байна. Алгасав.');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Log бичих
    const syncLog = await SyncLog.create({
      type,
      status: 'running',
      startedAt: new Date(),
    });

    logger.info(`🚀 Синк эхэллээ [${type}] - ID: ${syncLog._id}`);

    const stats = {
      totalFetched: 0,
      newVehicles: 0,
      updatedVehicles: 0,
      removedVehicles: 0,
      errors: 0,
    };

    try {
      const batchSize = parseInt(process.env.SYNC_BATCH_SIZE) || 100;
      
      // Encar-аас бүх машин татах
      const apiVehicles = await encarService.fetchAllVehicles(batchSize);
      stats.totalFetched = apiVehicles.length;

      if (apiVehicles.length === 0) {
        logger.warn('⚠️  Encar API-аас өгөгдөл ирсэнгүй');
      }

      // Одоо байгаа encarId-уудыг авах
      const existingIds = new Set(
        (await Vehicle.find({}, 'encarId').lean()).map(v => v.encarId)
      );

      // API-аас ирсэн ID-уудын жагсаалт
      const apiIds = new Set(apiVehicles.map(v => String(v.id)));

      // ─── Шинэ болон шинэчлэх ───
      for (const apiVehicle of apiVehicles) {
        try {
          const vehicleData = encarService.transformVehicle(apiVehicle);

          const existing = await Vehicle.findOne({ encarId: vehicleData.encarId });

          if (existing) {
            // Шинэчлэх
            await Vehicle.findOneAndUpdate(
              { encarId: vehicleData.encarId },
              { $set: vehicleData },
              { new: true }
            );
            stats.updatedVehicles++;
          } else {
            // Шинэ машин нэмэх
            await Vehicle.create(vehicleData);
            stats.newVehicles++;
            logger.info(`🆕 Шинэ машин нэмэгдлээ: ${vehicleData.title}`);
          }
        } catch (err) {
          logger.error(`Машин хадгалахад алдаа (${apiVehicle.id}): ${err.message}`);
          stats.errors++;
        }
      }

      // ─── Устгагдсан машинуудыг "sold" болгох ───
      const removedIds = [...existingIds].filter(id => !apiIds.has(id));
      if (removedIds.length > 0) {
        await Vehicle.updateMany(
          { encarId: { $in: removedIds } },
          { $set: { status: 'sold' } }
        );
        stats.removedVehicles = removedIds.length;
        logger.info(`🔴 ${removedIds.length} машин зарагдсан болгогдлоо`);
      }

      // Амжилттай дуусгах
      const duration = Date.now() - startTime;
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        status: 'success',
        completedAt: new Date(),
        stats,
        duration,
      });

      logger.info(`✅ Синк амжилттай дууслаа [${duration}ms]`);
      logger.info(`📊 Шинэ: ${stats.newVehicles} | Шинэчлэгдсэн: ${stats.updatedVehicles} | Зарагдсан: ${stats.removedVehicles} | Алдаа: ${stats.errors}`);

    } catch (error) {
      const duration = Date.now() - startTime;
      await SyncLog.findByIdAndUpdate(syncLog._id, {
        status: 'failed',
        completedAt: new Date(),
        stats,
        duration,
        errorMessage: error.message,
      });

      logger.error(`❌ Синк амжилтгүй болоо: ${error.message}`);
    } finally {
      this.isRunning = false;
    }

    return stats;
  }

  // ─────────────────────────────────────────
  // СИНКИЙН СТАТУС
  // ─────────────────────────────────────────
  async getSyncStatus() {
    const lastSync = await SyncLog.findOne().sort({ createdAt: -1 }).lean();
    return {
      isRunning: this.isRunning,
      lastSync,
    };
  }

  // ─────────────────────────────────────────
  // СИНКИЙН ТҮҮХ
  // ─────────────────────────────────────────
  async getSyncHistory(limit = 20) {
    return await SyncLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new SyncService();
