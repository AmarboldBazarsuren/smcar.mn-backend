const axios  = require('axios');
const path   = require('path');
const logger = require('../utils/logger');

// ── Орчуулгын толь бичгийг JSON-оос ачаалах ──
let T = { brands: {}, models: {}, suffixes: {}, fuel_types: {}, transmissions: {}, body_types: {}, colors: {}, regions: {}, features: {} };
try {
  T = require(path.join(process.cwd(), 'carTranslations.json'));
  logger.info('carTranslations.json амжилттай ачаалагдлаа');
} catch (e) {
  logger.warn(`carTranslations.json олдсонгүй: ${e.message}`);
}

// ─────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────

/** Толь бичгээс хайх — exact + case-insensitive */
function lookup(dict, raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (dict[t]) return dict[t];
  const l = t.toLowerCase();
  for (const [k, v] of Object.entries(dict)) {
    if (k.toLowerCase() === l) return v;
  }
  return null;
}

/** Текстийн дотор солонгос үгсийг орлуулах — model/badge дотрох suffix-үүдэд */
function replaceKoreanWords(text) {
  if (!text) return text;
  let result = text;

  // 1. Suffixes (스포츠 → Sport, 터보 → Turbo гэх мэт)
  for (const [ko, en] of Object.entries(T.suffixes || {})) {
    if (ko.length > 1) {
      result = result.replace(new RegExp(escapeRegex(ko), 'g'), en);
    }
  }

  // 2. Fuel type words inside model names (가솔린, 디젤, 하이브리드)
  for (const [ko, en] of Object.entries(T.fuel_types || {})) {
    if (/[가-힣]/.test(ko)) {
      result = result.replace(new RegExp(escapeRegex(ko), 'g'), en);
    }
  }

  // 3. Region names
  for (const [ko, en] of Object.entries(T.regions || {})) {
    result = result.replace(new RegExp(`^${escapeRegex(ko)}$`), en);
  }

  return result.trim();
}

/** Солонгос үсэг агуулж байгаа эсэх */
function hasKorean(str) {
  return str && /[가-힣]/.test(str);
}

/** Brand хөрвүүлэх */
function mapBrand(raw) {
  if (!raw) return raw;
  return lookup(T.brands, raw) || raw.trim();
}

/** Model хөрвүүлэх — толь → partial → suffix орлуулалт */
function mapModel(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();

  // 1. Шууд match
  const direct = lookup(T.models, trimmed);
  if (direct) return direct;

  // 2. Урт Korean prefix match (e.g. "올 뉴 투싼 가솔린 1.6 터보 2WD")
  let best = '';
  let bestLen = 0;
  for (const [ko, en] of Object.entries(T.models)) {
    if (hasKorean(ko) && trimmed.startsWith(ko) && ko.length > bestLen) {
      best = en;
      bestLen = ko.length;
    }
  }
  if (best) {
    // Үлдсэн хэсгийг suffix орлуулалтаар цэвэрлэх
    const rest = trimmed.slice(bestLen).trim();
    const cleanRest = replaceKoreanWords(rest);
    return cleanRest ? `${best} ${cleanRest}`.trim() : best;
  }

  // 3. Contains match
  for (const [ko, en] of Object.entries(T.models)) {
    if (hasKorean(ko) && ko.length > 2 && trimmed.includes(ko)) {
      const cleaned = trimmed.replace(ko, en);
      return replaceKoreanWords(cleaned);
    }
  }

  // 4. Already English — suffix-уудыг л орлуулах
  if (!hasKorean(trimmed)) return trimmed;

  // 5. Зөвхөн suffix орлуулалт
  return replaceKoreanWords(trimmed);
}

/** Badge хөрвүүлэх */
function mapBadge(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!hasKorean(trimmed)) return trimmed;
  return replaceKoreanWords(trimmed);
}

function mapFuel(raw) {
  if (!raw) return null;
  return lookup(T.fuel_types, raw) || null;
}

function mapTrans(raw) {
  if (!raw) return null;
  return lookup(T.transmissions, raw) || null;
}

function mapBody(raw) {
  if (!raw) return null;
  return lookup(T.body_types, raw) || null;
}

function mapColor(raw) {
  if (!raw) return raw;
  return lookup(T.colors, raw) || (hasKorean(raw) ? replaceKoreanWords(raw) : raw.trim());
}

function mapRegion(raw) {
  if (!raw) return raw;
  return lookup(T.regions, raw) || (hasKorean(raw) ? replaceKoreanWords(raw) : raw.trim());
}

function mapFeatures(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(f => {
    const s = typeof f === 'string' ? f : (f.name || f.Name || String(f));
    return lookup(T.features, s) || (hasKorean(s) ? replaceKoreanWords(s) : s);
  }).filter(Boolean);
}

const escapeRegex = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ════════════════════════════════════════════════════════
class EncarService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.encar.com',
      timeout: 30000,
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer':    'https://www.encar.com',
        'Origin':     'https://www.encar.com',
      },
    });

    this.client.interceptors.response.use(
      res => res,
      err => {
        logger.api.error(err.response?.status || 0, err.config?.url || '', err.message);
        return Promise.reject(err);
      }
    );
  }

  _getBrandCode(brand) {
    const map = {
      'hyundai': 'HY', 'kia': 'KI', 'genesis': 'GE',
      'ssangyong': 'SS', 'kgm': 'SS',
      'renault': 'RN', 'chevrolet': 'GM', 'daewoo': 'DW',
      'bmw': 'BM', 'mercedes-benz': 'MB', 'mercedes': 'MB', 'benz': 'MB',
      'audi': 'AU', 'volkswagen': 'VW', 'vw': 'VW',
      'volvo': 'VO', 'porsche': 'PO',
      'toyota': 'TY', 'honda': 'HO', 'nissan': 'NS',
      'lexus': 'LE', 'infiniti': 'IN',
      'mini': 'MI', 'jeep': 'JP',
      'land rover': 'LR', 'landrover': 'LR',
      'tesla': 'TE', 'ford': 'FD',
      'cadillac': 'CA', 'lincoln': 'LC',
      'maserati': 'MA', 'ferrari': 'FE',
      'bentley': 'BE', 'rolls-royce': 'RR',
      'jaguar': 'JG', 'mazda': 'MZ', 'subaru': 'SB',
    };
    return map[(brand || '').toLowerCase().trim()] || null;
  }

  _getFuelCode(fuel) {
    const map = { gasoline: 'G', diesel: 'D', electric: 'E', hybrid: 'H', lpg: 'L' };
    return map[(fuel || '').toLowerCase()] || null;
  }

  _buildQuery(params = {}) {
    const conds = ['And.Hidden.N.'];
    if (params.brand) {
      const code = this._getBrandCode(params.brand);
      if (code) conds.push(`_.Manufacturer.${code}.`);
    }
    if (params.year_min || params.year_max) {
      conds.push(`_.Year.range(${params.year_min || 1990}..${params.year_max || new Date().getFullYear()}).`);
    }
    if (params.price_min || params.price_max) {
      const mn = params.price_min ? Math.floor(params.price_min / 10000) : 0;
      const mx = params.price_max ? Math.floor(params.price_max / 10000) : 99999;
      conds.push(`_.Price.range(${mn}..${mx}).`);
    }
    if (params.fuel_type) {
      const code = this._getFuelCode(params.fuel_type);
      if (code) conds.push(`_.FuelType.${code}.`);
    }
    if (params.transmission) {
      conds.push(`_.Transmission.${params.transmission === 'Automatic' ? 'A' : 'M'}.`);
    }
    if (params.search) {
      return `(KeywordContain.${encodeURIComponent(params.search.trim())}.)`;
    }
    return `(${conds.join('_.')})`;
  }

  async getVehicles(params = {}) {
    try {
      const limit  = Math.min(100, params.limit || 20);
      const page   = params.page || 1;
      const offset = (page - 1) * limit;
      const query  = this._buildQuery(params);
      const sortMap = {
        '-createdAt': 'ModifiedDate', '-price': 'PriceDesc',
        'price': 'Price', '-year': 'YearDesc', 'mileage': 'Mileage',
      };

      const res = await this.client.get('/search/car/list/general', {
        params: { count: true, q: query, sr: `|${sortMap[params.sort] || 'ModifiedDate'}|${offset}|${limit}` },
      });

      return {
        success: true,
        data: {
          vehicles: (res.data?.SearchResults || []).map(c => this._transform(c)),
          pagination: {
            total: res.data?.Count || 0, page, limit,
            pages: Math.ceil((res.data?.Count || 0) / limit),
            has_more: offset + limit < (res.data?.Count || 0),
          },
        },
      };
    } catch (err) { throw this._handleError(err); }
  }

  async getVehicleById(id) {
    try {
      const res = await this.client.get(`/api/car/${id}`, { params: { includeEncarLite: true } });
      return { success: true, data: this._transformDetail(res.data) };
    } catch (err) { throw this._handleError(err); }
  }

  async fetchAllVehicles(batchSize = 100) {
    const all = [];
    let offset = 0, total = null, consecutiveErrors = 0;
    const MAX_ERRORS = 3, MAX_VEHICLES = 5000;

    logger.info('Encar.com-оос машинуудыг татаж байна...');

    while (true) {
      try {
        const res = await this.client.get('/search/car/list/general', {
          params: { count: true, q: '(And.Hidden.N.)', sr: `|ModifiedDate|${offset}|${batchSize}` },
        });
        const cars = res.data?.SearchResults || [];
        if (total === null) { total = res.data?.Count || 0; logger.info(`Нийт ${total} машин.`); }
        if (!cars.length) break;

        all.push(...cars);
        offset += batchSize;
        consecutiveErrors = 0;

        if (all.length % 500 === 0) logger.sync.progress(all.length, total);
        if (offset >= total || all.length >= MAX_VEHICLES) break;
        await this._sleep(300);

      } catch (err) {
        consecutiveErrors++;
        logger.error(`Batch алдаа offset=${offset}: ${err.message} (${consecutiveErrors}/${MAX_ERRORS})`);
        if (consecutiveErrors >= MAX_ERRORS) { logger.warn('Хэт олон алдаа. Зогсов.'); break; }
        await this._sleep(2000 * consecutiveErrors);
      }
    }

    logger.info(`Нийт ${all.length} машин татагдлаа`);
    return all;
  }

  // ── Core transform ──
  _transform(c) {
    const imgBase = 'https://ci.encar.com/carpicture';
    const photos  = c.Photos || [];

    const brand        = mapBrand(c.Manufacturer || c.maker || '');
    const model        = mapModel(c.Model || c.model || c.ModelGroup || '');
    const badge        = mapBadge(c.Badge || c.badge || null);
    const fuelType     = mapFuel(c.FuelType || c.fueltype || c.Fuel || '');
    const transmission = mapTrans(c.Transmission || c.transmission || c.Gear || '');
    const bodyType     = mapBody(c.BodyType || c.bodyType || c.Category || '');
    const color        = mapColor(c.Color || c.color || '');
    const location     = mapRegion(c.OfficeCityState || c.Region || c.region || '');

    let year = parseInt(c.Year) || 0;
    if (year > 100000) year = Math.floor(year / 100);
    else if (year > 10000) year = Math.floor(year / 100);

    return {
      encarId:        String(c.Id || c.id || ''),
      title:          [brand, model, badge, year].filter(Boolean).join(' ').trim(),
      brand,
      model,
      badge,
      year,
      price:          (c.Price || 0) * 10000,
      originalPrice:  null,
      mileage:        c.Mileage || c.mileage || 0,
      fuelType,
      transmission,
      engineSize:     c.Displacement ? `${c.Displacement}cc` : null,
      bodyType,
      color,
      doors:          c.Door  || c.door  || null,
      seats:          c.Seat  || c.seat  || null,
      location,
      dealer: {
        id:      String(c.OfficerId || ''),
        name:    c.OfficeName  || null,
        phone:   c.OfficeTelNo || null,
        address: location,
      },
      images: photos.map((p, i) => ({
        url: `${imgBase}${p.location}`, alt: `Image ${i + 1}`, isPrimary: i === 0,
      })),
      thumbnailUrl:   photos[0] ? `${imgBase}${photos[0].location}` : null,
      features:       [],
      description:    [brand, model, badge, year].filter(Boolean).join(' ').trim(),
      history: {
        accidents:      c.Accident     || 0,
        owners:         c.OwnerChanged || 1,
        serviceRecords: false,
      },
      viewCount:      c.ViewCount || 0,
      status:         'active',
      lastSyncedAt:   new Date(),
      encarCreatedAt: c.RegisterDate ? new Date(c.RegisterDate) : null,
      encarUpdatedAt: c.ModifiedDate  ? new Date(c.ModifiedDate) : null,
    };
  }

  _transformDetail(c) {
    const base = this._transform(c);
    return {
      ...base,
      fuelType:     mapFuel(c.FuelType || c.Fuel || '')      || base.fuelType,
      transmission: mapTrans(c.Transmission || c.Gear || '')  || base.transmission,
      color:        mapColor(c.Color || c.ColorName || '')    || base.color,
      engineSize:   c.EngineCapacity ? `${c.EngineCapacity}cc` : base.engineSize,
      doors:        c.Door || base.doors,
      seats:        c.Seat || base.seats,
      features:     mapFeatures(c.Options || c.options || []),
      description:  c.Description || c.description || base.description,
    };
  }

  transformVehicle(v) { return this._transform(v); }

  async getBrands() {
    return {
      success: true,
      data: [...new Set(Object.values(T.brands))].map(n => ({ id: n, name: n })),
    };
  }

  async getModelsByBrand()  { return { success: true, data: [] }; }
  async getPriceHistory()   { return { success: true, data: { price_history: [], trend: 'stable' } }; }
  async getDealers()        { return { success: true, data: [] }; }

  async getMarketStats() {
    try {
      const r = await this.client.get('/search/car/list/general', {
        params: { count: true, q: '(And.Hidden.N.)', sr: '|ModifiedDate|0|1' },
      });
      return { success: true, data: { total_vehicles: r.data?.Count || 0 } };
    } catch { return { success: true, data: { total_vehicles: 0 } }; }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _handleError(err) {
    const e = new Error(err.response?.data?.message || err.message || 'API алдаа');
    e.statusCode = err.response?.status || 500;
    return e;
  }
}

module.exports = new EncarService();