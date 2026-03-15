const axios  = require('axios');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════
// ENCAR.COM PUBLIC API — ШУУД
// Base URL : https://api.encar.com
// ══════════════════════════════════════════════════════════════

// ── Солонгос → Монгол хөрвүүлэгч maps ──

const FUEL_MAP = {
  // Encar raw values
  '가솔린':       'Gasoline',
  '디젤':         'Diesel',
  '전기':         'Electric',
  '하이브리드':   'Hybrid',
  'LPG':          'LPG',
  'lpg':          'LPG',
  // English codes from API
  'G':  'Gasoline',
  'D':  'Diesel',
  'E':  'Electric',
  'H':  'Hybrid',
  'L':  'LPG',
  'LPI':'LPG',
  'GH': 'Hybrid',
  'DH': 'Hybrid',
  // Sometimes returned as full English
  'Gasoline': 'Gasoline',
  'Diesel':   'Diesel',
  'Electric': 'Electric',
  'Hybrid':   'Hybrid',
  'LPG':      'LPG',
};

const TRANS_MAP = {
  '오토':     'Automatic',
  '자동':     'Automatic',
  '수동':     'Manual',
  '반자동':   'Manual',
  'A':        'Automatic',
  'M':        'Manual',
  'CVT':      'Automatic',
  'DCT':      'Automatic',
  'Automatic':'Automatic',
  'Manual':   'Manual',
};

const BODY_MAP = {
  '세단':       'Sedan',
  'SUV':        'SUV',
  '해치백':     'Hatchback',
  '왜건':       'Wagon',
  '쿠페':       'Coupe',
  '픽업트럭':   'Pickup',
  '밴':         'Van',
  '미니밴':     'Minivan',
  'RV':         'SUV',
  'MPV':        'Minivan',
};

// Korean brand name → English
const BRAND_MAP = {
  '기아':   'Kia',
  '현대':   'Hyundai',
  '제네시스':'Genesis',
  '쌍용':   'SsangYong',
  '르노':   'Renault',
  '한국GM': 'Chevrolet',
  '쉐보레': 'Chevrolet',
  'BMW':    'BMW',
  '벤츠':   'Mercedes-Benz',
  '아우디': 'Audi',
  '폭스바겐':'Volkswagen',
  '볼보':   'Volvo',
  '포르쉐': 'Porsche',
  '렉서스': 'Lexus',
  '인피니티':'Infiniti',
  '혼다':   'Honda',
  '토요타': 'Toyota',
  '닛산':   'Nissan',
  '미니':   'Mini',
  '랜드로버':'Land Rover',
  '재규어': 'Jaguar',
  '마세라티':'Maserati',
  '페라리': 'Ferrari',
  '람보르기니':'Lamborghini',
  '포드':   'Ford',
  '지프':   'Jeep',
  '크라이슬러':'Chrysler',
  '캐딜락': 'Cadillac',
  '링컨':   'Lincoln',
  '테슬라': 'Tesla',
};

// Нийтлэг Солонгос загварын нэр → Англи
const MODEL_MAP = {
  // Kia
  '카니발':      'Carnival',
  '올 뉴 카니발':'Carnival',
  '스포티지':    'Sportage',
  '쏘렌토':      'Sorento',
  '모하비':      'Mohave',
  '스팅어':      'Stinger',
  'K5':          'K5',
  'K7':          'K7',
  'K8':          'K8',
  'K9':          'K9',
  '셀토스':      'Seltos',
  '니로':        'Niro',
  '레이':        'Ray',
  '모닝':        'Morning',
  'EV6':         'EV6',
  'EV9':         'EV9',
  // Hyundai
  '아반떼':      'Avante',
  '쏘나타':      'Sonata',
  '그랜저':      'Grandeur',
  '투싼':        'Tucson',
  '싼타페':      'Santa Fe',
  '팰리세이드':  'Palisade',
  '아이오닉':    'Ioniq',
  '코나':        'Kona',
  '베뉴':        'Venue',
  '스타리아':    'Staria',
  '넥쏘':        'Nexo',
  '포터':        'Porter',
  // Genesis
  'G70':         'G70',
  'G80':         'G80',
  'G90':         'G90',
  'GV70':        'GV70',
  'GV80':        'GV80',
  'GV90':        'GV90',
  // SsangYong/KGM
  '티볼리':      'Tivoli',
  '코란도':      'Korando',
  '렉스턴':      'Rexton',
  '무쏘':        'Musso',
  // Renault
  'QM6':         'QM6',
  'SM6':         'SM6',
  '조에':        'Zoe',
  // Chevrolet Korea
  '말리부':      'Malibu',
  '트레일블레이저':'Trailblazer',
  '트랙스':      'Trax',
  '이쿼녹스':    'Equinox',
  '볼트':        'Bolt',
};

// Safe regex escape
const escapeRegex = s => (s||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mapFuel(raw) {
  if (!raw) return null;
  return FUEL_MAP[raw] || FUEL_MAP[raw?.trim()] || raw;
}

function mapTrans(raw) {
  if (!raw) return null;
  return TRANS_MAP[raw] || TRANS_MAP[raw?.trim()] || raw;
}

function mapBody(raw) {
  if (!raw) return null;
  return BODY_MAP[raw] || BODY_MAP[raw?.trim()] || raw;
}

function mapBrand(raw) {
  if (!raw) return raw;
  return BRAND_MAP[raw?.trim()] || raw;
}

function mapModel(raw) {
  if (!raw) return raw;
  // Exact match эхлээд
  if (MODEL_MAP[raw?.trim()]) return MODEL_MAP[raw.trim()];
  // Partial match
  for (const [ko, en] of Object.entries(MODEL_MAP)) {
    if (raw.includes(ko)) return en;
  }
  return raw;
}

class EncarService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.encar.com',
      timeout: 30000,
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

    logger.info('Encar.com API эхэллээ');
  }

  // ── Query builder ──
  _buildQuery(params = {}) {
    const conds = ['And.Hidden.N.'];

    if (params.brand) {
      const code = this._getBrandCode(params.brand);
      if (code) conds.push(`_.Manufacturer.${code}.`);
    }
    if (params.model)    conds.push(`_.ModelGroup.${escapeRegex(params.model)}.`);
    if (params.year_min || params.year_max) {
      const mn = params.year_min || 1990;
      const mx = params.year_max || new Date().getFullYear();
      conds.push(`_.Year.range(${mn}..${mx}).`);
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
      return `(KeywordContain.${encodeURIComponent(params.search)}.)`;
    }
    return `(${conds.join('_.')})`;
  }

  _getBrandCode(brand) {
    const map = {
      'hyundai':'HY','kia':'KI','genesis':'GE','ssangyong':'SS',
      'kgm':'SS','samsung':'SM','chevrolet':'GM','bmw':'BM',
      'mercedes':'MB','mercedes-benz':'MB','benz':'MB','audi':'AU',
      'toyota':'TY','honda':'HO','nissan':'NS','volkswagen':'VW',
      'ford':'FD','volvo':'VO','porsche':'PO','lexus':'LE',
      'infiniti':'IN','mini':'MI','jeep':'JP','land rover':'LR',
      'landrover':'LR','tesla':'TE','renault':'RN',
    };
    return map[(brand||'').toLowerCase().trim()] || null;
  }

  _getFuelCode(fuel) {
    const map = { gasoline:'G',diesel:'D',electric:'E',hybrid:'H',lpg:'L' };
    return map[(fuel||'').toLowerCase()] || null;
  }

  // ── Машинуудын жагсаалт ──
  async getVehicles(params = {}) {
    try {
      const limit  = params.limit || 20;
      const page   = params.page  || 1;
      const offset = (page - 1) * limit;
      const query  = this._buildQuery(params);
      const sortMap = {
        '-createdAt':'ModifiedDate','-price':'PriceDesc',
        'price':'Price','-year':'YearDesc','mileage':'Mileage',
      };
      const sortField = sortMap[params.sort] || 'ModifiedDate';

      const res = await this.client.get('/search/car/list/general', {
        params: { count: true, q: query, sr: `|${sortField}|${offset}|${limit}` },
      });

      const cars  = res.data?.SearchResults || res.data?.Results || [];
      const total = res.data?.Count || 0;

      return {
        success: true,
        data: {
          vehicles: cars.map(c => this._transformFromEncar(c)),
          pagination: {
            total, page, limit,
            pages: Math.ceil(total / limit),
            has_more: offset + limit < total,
          },
        },
      };
    } catch (err) {
      throw this._handleError(err);
    }
  }

  // ── Нэг машин ──
  async getVehicleById(id) {
    try {
      const res = await this.client.get(`/api/car/${id}`, {
        params: { includeEncarLite: true },
      });
      return { success: true, data: this._transformFromEncarDetail(res.data) };
    } catch (err) {
      throw this._handleError(err);
    }
  }

  // ── Бүгдийг batch-аар татах ──
  async fetchAllVehicles(batchSize = 50) {
    const all  = [];
    let offset = 0;
    let total  = null;

    logger.info('Encar.com-оос машинуудыг татаж байна...');

    while (true) {
      try {
        const res = await this.client.get('/search/car/list/general', {
          params: { count: true, q: '(And.Hidden.N.)', sr: `|ModifiedDate|${offset}|${batchSize}` },
        });

        const cars = res.data?.SearchResults || [];
        if (total === null) total = res.data?.Count || 0;

        if (!cars.length) break;

        all.push(...cars);
        offset += batchSize;

        logger.sync.progress(all.length, total);

        if (offset >= total) break;
        if (all.length >= 2000) {
          logger.info('2000 хязгаарт хүрлээ');
          break;
        }

        await this._sleep(400);
      } catch (err) {
        logger.error(`Batch алдаа offset=${offset}: ${err.message}`);
        break;
      }
    }

    logger.info(`Нийт ${all.length} машин татагдлаа`);
    return all;
  }

  // ══════════════════════════════════════════
  // TRANSFORM — Encar list item → MongoDB
  // ══════════════════════════════════════════
  _transformFromEncar(c) {
    const imgBase   = 'https://ci.encar.com/carpicture';
    const photos    = c.Photos || [];
    const thumb     = photos[0] ? `${imgBase}${photos[0].location}` : null;
    const images    = photos.map((p, i) => ({
      url:       `${imgBase}${p.location}`,
      alt:       `Зураг ${i + 1}`,
      isPrimary: i === 0,
    }));

    // Brand/Model хөрвүүлэх
    const rawBrand = c.Manufacturer || c.maker || '';
    const rawModel = c.Model        || c.model || '';
    const brand    = mapBrand(rawBrand);
    const model    = mapModel(rawModel);

    // Fuel/Trans хөрвүүлэх — олон боломжит field нэрийг шалгана
    const rawFuel  = c.FuelType  || c.fueltype  || c.fuel_type  || c.Fuel  || '';
    const rawTrans = c.Transmission || c.transmission || c.trans || '';

    const fuelType    = mapFuel(rawFuel);
    const transmission = mapTrans(rawTrans);

    // Жил — 202211 гэх маягаар ирж болно
    let year = parseInt(c.Year) || 0;
    if (year > 10000) year = Math.floor(year / 100); // 202211 → 2022

    return {
      encarId:       String(c.Id || c.id || ''),
      title:         `${brand} ${model} ${year}`.trim(),
      brand,
      model,
      badge:         c.Badge || c.badge || null,
      year,

      price:         (c.Price || 0) * 10000,
      originalPrice: null,

      mileage:       c.Mileage    || c.mileage    || 0,
      fuelType,
      transmission,
      engineSize:    c.Displacement ? `${c.Displacement}cc` : (c.displacement ? `${c.displacement}cc` : null),
      bodyType:      mapBody(c.BodyType || c.bodyType || c.body_type || ''),
      color:         c.Color      || c.color      || null,
      doors:         c.Door       || c.door       || null,
      seats:         c.Seat       || c.seat       || null,

      location:      c.OfficeCityState || c.Region || c.region || null,

      dealer: {
        id:      String(c.OfficerId || ''),
        name:    c.OfficeName  || c.officeName || null,
        phone:   c.OfficeTelNo || null,
        address: c.OfficeCityState || null,
      },

      images,
      thumbnailUrl: thumb,

      features:    [],
      description: `${brand} ${model} ${year}`.trim(),

      history: {
        accidents:      c.Accident     || 0,
        owners:         c.OwnerChanged || 1,
        serviceRecords: false,
      },

      viewCount:      c.ViewCount  || 0,
      status:        'active',
      lastSyncedAt:   new Date(),
      encarCreatedAt: c.RegisterDate ? new Date(c.RegisterDate) : null,
      encarUpdatedAt: c.ModifiedDate  ? new Date(c.ModifiedDate) : null,
    };
  }

  // ── Detail API хариу (нэмэлт талбарууд) ──
  _transformFromEncarDetail(c) {
    const base = this._transformFromEncar(c);

    // Detail-д илүү нарийн field-үүд байдаг
    const rawFuel   = c.FuelType || c.fueltype || c.Fuel || base.fuelType || '';
    const rawTrans  = c.Transmission || c.transmission || c.Gear || base.transmission || '';
    const rawColor  = c.Color || c.color || c.ColorName || base.color;
    const rawEngine = c.EngineCapacity || c.engineCapacity || c.displacement ||
                      (base.engineSize ? parseInt(base.engineSize) : null);

    // Features (Options array)
    let features = [];
    if (Array.isArray(c.Options)) {
      features = c.Options.map(o => o.name || o.Name || String(o)).filter(Boolean);
    } else if (Array.isArray(c.options)) {
      features = c.options.map(o => o.name || String(o)).filter(Boolean);
    }

    return {
      ...base,
      fuelType:     mapFuel(rawFuel)   || base.fuelType,
      transmission: mapTrans(rawTrans) || base.transmission,
      color:        rawColor           || base.color,
      engineSize:   rawEngine ? `${rawEngine}cc` : base.engineSize,
      doors:        c.Door   || c.door   || base.doors,
      seats:        c.Seat   || c.seat   || base.seats,
      features,
      description:  c.Description || c.description || base.description,
      dealer: {
        ...base.dealer,
        phone: c.OfficeTelNo || c.SellerPhone || base.dealer?.phone || null,
      },
    };
  }

  // Alias — syncService дуудна
  transformVehicle(v) {
    return this._transformFromEncar(v);
  }

  async getBrands() {
    return { success: true, data: Object.values(BRAND_MAP).map(n => ({ id: n, name: n })) };
  }

  async getModelsByBrand() { return { success: true, data: [] }; }

  async getMarketStats() {
    try {
      const r = await this.client.get('/search/car/list/general', {
        params: { count: true, q: '(And.Hidden.N.)', sr: '|ModifiedDate|0|1' },
      });
      return { success: true, data: { total_vehicles: r.data?.Count || 0 } };
    } catch { return { success: true, data: { total_vehicles: 0 } }; }
  }

  async getPriceHistory() { return { success: true, data: { price_history: [], trend: 'stable' } }; }
  async getDealers()      { return { success: true, data: [] }; }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _handleError(err) {
    const e = new Error(err.response?.data?.message || err.message || 'API алдаа');
    e.statusCode = err.response?.status || 500;
    return e;
  }
}

module.exports = new EncarService();