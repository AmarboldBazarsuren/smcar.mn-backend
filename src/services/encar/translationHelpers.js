
const path   = require('path');
const logger = require('../../utils/logger');

// ── Орчуулгын толь ачаалах ──
let T = {
  brands: {}, models: {}, suffixes: {},
  fuel_types: {}, transmissions: {}, body_types: {},
  colors: {}, regions: {}, features: {},
};

try {
  T = require(path.join(process.cwd(), 'carTranslations.json'));
  logger.info('carTranslations.json амжилттай ачаалагдлаа');
} catch (e) {
  logger.warn(`carTranslations.json олдсонгүй: ${e.message}`);
}

// ─────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────

/** Regex-д аюултай тэмдэгтүүдийг escape хийх */
const escapeRegex = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Солонгос үсэг агуулж байгаа эсэх */
function hasKorean(str) {
  return str && /[가-힣]/.test(str);
}

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

/** Текстийн дотор солонгос үгсийг орлуулах */
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

// ─────────────────────────────────────────
// MAP FUNCTIONS
// ─────────────────────────────────────────

function mapBrand(raw) {
  if (!raw) return raw;
  return lookup(T.brands, raw) || raw.trim();
}

function mapModel(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();

  const direct = lookup(T.models, trimmed);
  if (direct) return direct;

  // Урт Korean prefix match
  let best = '', bestLen = 0;
  for (const [ko, en] of Object.entries(T.models)) {
    if (hasKorean(ko) && trimmed.startsWith(ko) && ko.length > bestLen) {
      best = en;
      bestLen = ko.length;
    }
  }
  if (best) {
    const rest      = trimmed.slice(bestLen).trim();
    const cleanRest = replaceKoreanWords(rest);
    return cleanRest ? `${best} ${cleanRest}`.trim() : best;
  }

  // Contains match
  for (const [ko, en] of Object.entries(T.models)) {
    if (hasKorean(ko) && ko.length > 2 && trimmed.includes(ko)) {
      return replaceKoreanWords(trimmed.replace(ko, en));
    }
  }

  if (!hasKorean(trimmed)) return trimmed;
  return replaceKoreanWords(trimmed);
}

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

module.exports = {
  T,
  escapeRegex,
  hasKorean,
  lookup,
  replaceKoreanWords,
  mapBrand,
  mapModel,
  mapBadge,
  mapFuel,
  mapTrans,
  mapBody,
  mapColor,
  mapRegion,
  mapFeatures,
};