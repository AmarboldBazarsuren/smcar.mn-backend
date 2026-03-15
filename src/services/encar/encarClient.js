
const axios  = require('axios');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────
// AXIOS CLIENT
// ─────────────────────────────────────────
const client = axios.create({
  baseURL: 'https://api.encar.com',
  timeout: 30000,
  headers: {
    'Accept':     'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer':    'https://www.encar.com',
    'Origin':     'https://www.encar.com',
  },
});

client.interceptors.response.use(
  res => res,
  err => {
    logger.api.error(err.response?.status || 0, err.config?.url || '', err.message);
    return Promise.reject(err);
  }
);

// ─────────────────────────────────────────
// BRAND CODE MAP
// ─────────────────────────────────────────
const BRAND_CODES = {
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

const FUEL_CODES = {
  gasoline: 'G', diesel: 'D', electric: 'E', hybrid: 'H', lpg: 'L',
};

function getBrandCode(brand) {
  return BRAND_CODES[(brand || '').toLowerCase().trim()] || null;
}

function getFuelCode(fuel) {
  return FUEL_CODES[(fuel || '').toLowerCase()] || null;
}

// ─────────────────────────────────────────
// QUERY BUILDER
// ─────────────────────────────────────────
function buildQuery(params = {}) {
  const conds = ['And.Hidden.N.'];

  if (params.brand) {
    const code = getBrandCode(params.brand);
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
    const code = getFuelCode(params.fuel_type);
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

// ─────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────
function handleError(err) {
  const e = new Error(err.response?.data?.message || err.message || 'API алдаа');
  e.statusCode = err.response?.status || 500;
  return e;
}

module.exports = { client, buildQuery, getBrandCode, getFuelCode, handleError };