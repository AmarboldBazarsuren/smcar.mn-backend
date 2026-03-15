const axios = require('axios');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════
// ENCAR.COM ШУУД PUBLIC API — ҮНЭГҮЙ, SUBSCRIPTION ШААРДАХГҮЙ!
//
// Carapis → Төлбөртэй middleman → ХАЯВ
// Encar.com → Шууд public API → АШИГЛАНА ✅
//
// Base URL : https://api.encar.com
// Auth     : Шаардахгүй (public API)
// ══════════════════════════════════════════════════════════════

class EncarService {
  constructor() {
    // Encar.com-ийн шууд API
    this.client = axios.create({
      baseURL: 'https://api.encar.com',
      timeout: 30000,
      headers: {
        'Accept':          'application/json',
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':         'https://www.encar.com',
        'Origin':          'https://www.encar.com',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`📡 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (err) => Promise.reject(err)
    );

    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        logger.error(`❌ [${err.response?.status}] ${err.config?.url}: ${err.message}`);
        return Promise.reject(err);
      }
    );

    logger.info('✅ Encar.com шууд API эхэллээ [Үнэгүй, subscription шаардахгүй]');
  }

  // ─────────────────────────────────────────
  // Encar.com query builder
  // ─────────────────────────────────────────
  _buildQuery(params = {}) {
    const conditions = ['And.Hidden.N.'];

    if (params.brand) {
      // Manufacturer code хайх (Hyundai=HY, Kia=KI, etc.)
      const brandCode = this._getBrandCode(params.brand);
      if (brandCode) conditions.push(`_.Manufacturer.${brandCode}.`);
    }

    if (params.model) {
      conditions.push(`_.ModelGroup.${params.model}.`);
    }

    if (params.year_min || params.year_max) {
      const min = params.year_min || 1990;
      const max = params.year_max || new Date().getFullYear();
      conditions.push(`_.Year.range(${min}..${max}).`);
    }

    if (params.price_min || params.price_max) {
      const min = params.price_min ? Math.floor(params.price_min / 10000) : 0;
      const max = params.price_max ? Math.floor(params.price_max / 10000) : 99999;
      conditions.push(`_.Price.range(${min}..${max}).`);
    }

    if (params.fuel_type) {
      const fuelCode = this._getFuelCode(params.fuel_type);
      if (fuelCode) conditions.push(`_.FuelType.${fuelCode}.`);
    }

    if (params.transmission) {
      const transCode = params.transmission === 'Automatic' ? 'A' : 'M';
      conditions.push(`_.Transmission.${transCode}.`);
    }

    if (params.search) {
      return `(KeywordContain.${encodeURIComponent(params.search)}.)`;
    }

    return `(${conditions.join('_.')})`;
  }

  _getBrandCode(brand) {
    const map = {
      'hyundai': 'HY', 'kia': 'KI', 'genesis': 'GE',
      'ssangyong': 'SS', 'samsung': 'SM', 'chevrolet': 'GM',
      'bmw': 'BM', 'mercedes': 'MB', 'audi': 'AU',
      'toyota': 'TY', 'honda': 'HO', 'nissan': 'NS',
      'volkswagen': 'VW', 'ford': 'FD', 'volvo': 'VO',
      'porsche': 'PO', 'lexus': 'LE', 'infiniti': 'IN',
      'mini': 'MI', 'jeep': 'JP', 'land rover': 'LR',
    };
    return map[brand.toLowerCase()] || null;
  }

  _getFuelCode(fuel) {
    const map = {
      'gasoline': 'G', 'diesel': 'D', 'electric': 'E',
      'hybrid': 'H', 'lpg': 'L',
    };
    return map[fuel.toLowerCase()] || null;
  }

  // ─────────────────────────────────────────
  // МАШИНУУДЫН ЖАГСААЛТ
  // GET /search/car/list/general
  // ─────────────────────────────────────────
  async getVehicles(params = {}) {
    try {
      const limit  = params.limit  || 20;
      const page   = params.page   || 1;
      const offset = (page - 1) * limit;
      const query  = this._buildQuery(params);

      // Эрэмбэлэлт
      const sortMap = {
        '-createdAt': 'ModifiedDate',
        '-price':     'PriceDesc',
        'price':      'Price',
        '-year':      'YearDesc',
        'mileage':    'Mileage',
      };
      const sortField = sortMap[params.sort] || 'ModifiedDate';

      const res = await this.client.get('/search/car/list/general', {
        params: {
          count: true,
          q:     query,
          sr:    `|${sortField}|${offset}|${limit}`,
        },
      });

      const raw  = res.data;
      const cars = raw?.SearchResults || raw?.Results || [];
      const total = raw?.Count || 0;

      // Encar format → манай стандарт формат
      const vehicles = cars.map(c => this._transformFromEncar(c));

      return {
        success: true,
        data: {
          vehicles,
          pagination: {
            total,
            page,
            limit,
            pages:    Math.ceil(total / limit),
            has_more: offset + limit < total,
          },
        },
      };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  // ─────────────────────────────────────────
  // НЭГ МАШИНЫ ДЭЛГЭРЭНГҮЙ
  // GET /api/car/{id}
  // ─────────────────────────────────────────
  async getVehicleById(id) {
    try {
      const res = await this.client.get(`/api/car/${id}`, {
        params: { includeEncarLite: true },
      });
      const vehicle = this._transformFromEncarDetail(res.data);
      return { success: true, data: vehicle };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  // ─────────────────────────────────────────
  // БРЕНД ЖАГСААЛТ (статик — Encar бүх брэнд)
  // ─────────────────────────────────────────
  async getBrands() {
    return {
      success: true,
      data: [
        { id: 'HY', name: 'Hyundai',    slug: 'hyundai' },
        { id: 'KI', name: 'Kia',        slug: 'kia' },
        { id: 'GE', name: 'Genesis',    slug: 'genesis' },
        { id: 'SS', name: 'Ssangyong',  slug: 'ssangyong' },
        { id: 'SM', name: 'Samsung',    slug: 'samsung' },
        { id: 'GM', name: 'Chevrolet',  slug: 'chevrolet' },
        { id: 'BM', name: 'BMW',        slug: 'bmw' },
        { id: 'MB', name: 'Mercedes',   slug: 'mercedes' },
        { id: 'AU', name: 'Audi',       slug: 'audi' },
        { id: 'TY', name: 'Toyota',     slug: 'toyota' },
        { id: 'HO', name: 'Honda',      slug: 'honda' },
        { id: 'NS', name: 'Nissan',     slug: 'nissan' },
        { id: 'VW', name: 'Volkswagen', slug: 'volkswagen' },
        { id: 'LE', name: 'Lexus',      slug: 'lexus' },
        { id: 'VO', name: 'Volvo',      slug: 'volvo' },
        { id: 'PO', name: 'Porsche',    slug: 'porsche' },
      ],
    };
  }

  async getModelsByBrand(brand) {
    try {
      const Vehicle = require('../models/Vehicle');
      const rows = await Vehicle.aggregate([
        { $match: { brand: new RegExp(brand, 'i'), status: 'active' } },
        { $group: { _id: '$model', count: { $sum: 1 }, years: { $addToSet: '$year' } } },
        { $sort: { count: -1 } },
      ]);
      return {
        success: true,
        data: rows.map(r => ({
          id: r._id, name: r._id, count: r.count,
          years: r.years.sort((a, b) => b - a),
        })),
      };
    } catch {
      return { success: true, data: [] };
    }
  }

  async getMarketStats() {
    try {
      const res = await this.client.get('/search/car/list/general', {
        params: { count: true, q: '(And.Hidden.N.)', sr: '|ModifiedDate|0|1' },
      });
      return {
        success: true,
        data: {
          total_vehicles: res.data?.Count || 0,
          average_price:  0,
          price_trend:    'stable',
          popular_brands: [],
        },
      };
    } catch {
      return { success: true, data: { total_vehicles: 0, average_price: 0, price_trend: 'stable', popular_brands: [] } };
    }
  }

  async getPriceHistory(vehicleId) {
    return { success: true, data: { vehicle_id: vehicleId, price_history: [], trend: 'stable' } };
  }

  async getDealers()      { return { success: true, data: [] }; }
  async getDealerById(id) { return { success: true, data: null }; }

  // ─────────────────────────────────────────
  // БҮГДИЙГ БАТЧ-ААР ТАТАХ
  // ─────────────────────────────────────────
  async fetchAllVehicles(batchSize = 50) {
    const all   = [];
    let offset  = 0;
    let hasMore = true;

    logger.info('🔄 Encar.com-оос машинуудыг татаж байна...');

    while (hasMore) {
      try {
        const res = await this.client.get('/search/car/list/general', {
          params: {
            count: true,
            q:     '(And.Hidden.N.)',
            sr:    `|ModifiedDate|${offset}|${batchSize}`,
          },
        });

        const cars  = res.data?.SearchResults || [];
        const total = res.data?.Count || 0;

        if (!cars.length) break;

        all.push(...cars);
        offset  += batchSize;
        hasMore  = offset < total;

        logger.info(`📦 ${all.length}/${total} машин`);

        if (hasMore) await this._sleep(500);
        if (all.length >= 1000) { logger.info('📌 1000 хязгаар.'); break; }

      } catch (err) {
        logger.error(`Batch алдаа offset=${offset}: ${err.message}`);
        break;
      }
    }

    logger.info(`✅ Нийт ${all.length} машин`);
    return all;
  }

  // ─────────────────────────────────────────
  // Encar list item → MongoDB схем
  // ─────────────────────────────────────────
  _transformFromEncar(c) {
    const photo = c.Photos?.[0];
    const imgBase = 'https://ci.encar.com/carpicture';
    const thumbnailUrl = photo
      ? `${imgBase}${photo.location}`
      : null;

    return {
      encarId:      String(c.Id),
      title:        `${c.Manufacturer || ''} ${c.Model || ''} ${c.Badge || ''} ${c.Year || ''}`.trim(),
      brand:        c.Manufacturer || 'Unknown',
      model:        c.Model        || 'Unknown',
      year:         parseInt(c.Year) || new Date().getFullYear(),

      price:         (c.Price || 0) * 10000,  // 만원 → 원
      originalPrice: null,
      priceKrw:      (c.Price || 0) * 10000,

      mileage:      c.Mileage      || 0,
      fuelType:     c.FuelType     || null,
      transmission: c.Transmission === 'A' ? 'Automatic' : c.Transmission === 'M' ? 'Manual' : c.Transmission,
      engineSize:   c.Displacement ? `${c.Displacement}cc` : null,
      bodyType:     c.BodyType     || null,
      color:        c.Color        || null,
      doors:        null,
      seats:        null,

      location:      c.OfficeCityState || c.Region || null,
      locationDetail: null,

      dealer: {
        id:       String(c.OfficerId || ''),
        name:     c.OfficeName || null,
        rating:   null,
        phone:    null,
        address:  c.OfficeCityState || null,
        verified: c.IsCertified || false,
      },

      images: (c.Photos || []).map((p, i) => ({
        url:       `${imgBase}${p.location}`,
        alt:       `Зураг ${i + 1}`,
        isPrimary: i === 0,
      })),
      thumbnailUrl,

      features:    [],
      description: `${c.Manufacturer || ''} ${c.Model || ''} ${c.Badge || ''} ${c.Year || ''}`.trim(),

      history: {
        accidents:      c.Accident     || 0,
        owners:         c.OwnerChanged || 1,
        serviceRecords: false,
      },

      viewCount:     c.ViewCount || 0,
      status:       'active',
      lastSyncedAt:  new Date(),
      encarCreatedAt: c.RegisterDate ? new Date(c.RegisterDate) : null,
      encarUpdatedAt: c.ModifiedDate  ? new Date(c.ModifiedDate)  : null,
    };
  }

  // Detail API хариу
  _transformFromEncarDetail(c) {
    const base = this._transformFromEncar(c);
    return {
      ...base,
      engineSize:  c.EngineCapacity ? `${c.EngineCapacity}cc` : base.engineSize,
      color:       c.Color          || base.color,
      doors:       c.Door           || null,
      seats:       c.Seat           || null,
      features:    c.Options?.map(o => o.name || o) || [],
      description: c.Description   || base.description,
      dealer: {
        ...base.dealer,
        phone: c.OfficeTelNo || c.SellerPhone || null,
      },
    };
  }

  // Alias - syncService дуудна
  transformVehicle(v) {
    return this._transformFromEncar(v);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _handleError(error) {
    const err = new Error(error.response?.data?.message || error.message || 'API алдаа');
    err.statusCode = error.response?.status || 500;
    err.code = 'API_ERROR';
    return err;
  }
}

module.exports = new EncarService();