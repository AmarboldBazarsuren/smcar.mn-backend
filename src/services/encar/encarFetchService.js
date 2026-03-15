/**
 * src/services/encar/encarFetchService.js
 *
 * Encar API-аас машинуудыг татах функцууд:
 *   - getVehicles()      → хуудасчилсан жагсаалт
 *   - getVehicleById()   → нэг машины дэлгэрэнгүй
 *   - fetchAllVehicles() → sync-д зориулсан бүх машин татах
 *   - getMarketStats()   → нийт тоо
 */

const logger  = require('../../utils/logger');
const { client, buildQuery, handleError } = require('./encarClient');
const { transform, transformDetail }      = require('./encarTransformService');

const SORT_MAP = {
  '-createdAt': 'ModifiedDate',
  '-price':     'PriceDesc',
  'price':      'Price',
  '-year':      'YearDesc',
  'mileage':    'Mileage',
};

// ─────────────────────────────────────────
// ХУУДАСЧИЛСАН ЖАГСААЛТ
// ─────────────────────────────────────────
async function getVehicles(params = {}) {
  try {
    const limit  = Math.min(100, params.limit || 20);
    const page   = params.page || 1;
    const offset = (page - 1) * limit;
    const query  = buildQuery(params);
    const sort   = SORT_MAP[params.sort] || 'ModifiedDate';

    const res = await client.get('/search/car/list/general', {
      params: { count: true, q: query, sr: `|${sort}|${offset}|${limit}` },
    });

    return {
      success: true,
      data: {
        vehicles: (res.data?.SearchResults || []).map(transform),
        pagination: {
          total:    res.data?.Count || 0,
          page,
          limit,
          pages:    Math.ceil((res.data?.Count || 0) / limit),
          has_more: offset + limit < (res.data?.Count || 0),
        },
      },
    };
  } catch (err) {
    throw handleError(err);
  }
}

// ─────────────────────────────────────────
// НЭГ МАШИНЫ ДЭЛГЭРЭНГҮЙ
// ─────────────────────────────────────────
async function getVehicleById(id) {
  try {
    const res = await client.get(`/api/car/${id}`, {
      params: { includeEncarLite: true },
    });
    return { success: true, data: transformDetail(res.data) };
  } catch (err) {
    throw handleError(err);
  }
}

// ─────────────────────────────────────────
// SYNC-Д ЗОРИУЛСАН БҮХ МАШИН ТАТАХ
// ─────────────────────────────────────────
async function fetchAllVehicles(batchSize = 100) {
  const all = [];
  let offset = 0, total = null, consecutiveErrors = 0;
  const MAX_ERRORS = 3, MAX_VEHICLES = 5000;

  logger.info('Encar.com-оос машинуудыг татаж байна...');

  while (true) {
    try {
      const res = await client.get('/search/car/list/general', {
        params: {
          count: true,
          q:     '(And.Hidden.N.)',
          sr:    `|ModifiedDate|${offset}|${batchSize}`,
        },
      });

      const cars = res.data?.SearchResults || [];
      if (total === null) {
        total = res.data?.Count || 0;
        logger.info(`Нийт ${total} машин.`);
      }
      if (!cars.length) break;

      all.push(...cars);
      offset += batchSize;
      consecutiveErrors = 0;

      if (all.length % 500 === 0) logger.sync.progress(all.length, total);
      if (offset >= total || all.length >= MAX_VEHICLES) break;

      await _sleep(300);

    } catch (err) {
      consecutiveErrors++;
      logger.error(`Batch алдаа offset=${offset}: ${err.message} (${consecutiveErrors}/${MAX_ERRORS})`);
      if (consecutiveErrors >= MAX_ERRORS) {
        logger.warn('Хэт олон алдаа. Зогсов.');
        break;
      }
      await _sleep(2000 * consecutiveErrors);
    }
  }

  logger.info(`Нийт ${all.length} машин татагдлаа`);
  return all;
}

// ─────────────────────────────────────────
// ЗАХЫН СТАТИСТИК
// ─────────────────────────────────────────
async function getMarketStats() {
  try {
    const r = await client.get('/search/car/list/general', {
      params: { count: true, q: '(And.Hidden.N.)', sr: '|ModifiedDate|0|1' },
    });
    return { success: true, data: { total_vehicles: r.data?.Count || 0 } };
  } catch {
    return { success: true, data: { total_vehicles: 0 } };
  }
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { getVehicles, getVehicleById, fetchAllVehicles, getMarketStats };