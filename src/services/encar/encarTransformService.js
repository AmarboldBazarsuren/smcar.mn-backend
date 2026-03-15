const {
  mapBrand, mapModel, mapBadge,
  mapFuel, mapTrans, mapBody,
  mapColor, mapRegion, mapFeatures,
} = require('./translationHelpers');

const IMG_BASE = 'https://ci.encar.com/carpicture';

// ─────────────────────────────────────────
// YEAR NORMALIZE
// ─────────────────────────────────────────
function normalizeYear(raw) {
  let year = parseInt(raw) || 0;
  if (year > 100000) return Math.floor(year / 100);
  if (year > 10000)  return Math.floor(year / 100);
  return year;
}

// ─────────────────────────────────────────
// TRANSFORM — жагсаалтын нэг машин
// ─────────────────────────────────────────
function transform(c) {
  const photos = c.Photos || [];

  const brand        = mapBrand(c.Manufacturer || c.maker || '');
  const model        = mapModel(c.Model || c.model || c.ModelGroup || '');
  const badge        = mapBadge(c.Badge || c.badge || null);
  const fuelType     = mapFuel(c.FuelType || c.fueltype || c.Fuel || '');
  const transmission = mapTrans(c.Transmission || c.transmission || c.Gear || '');
  const bodyType     = mapBody(c.BodyType || c.bodyType || c.Category || '');
  const color        = mapColor(c.Color || c.color || '');
  const location     = mapRegion(c.OfficeCityState || c.Region || c.region || '');
  const year         = normalizeYear(c.Year);

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
      url:       `${IMG_BASE}${p.location}`,
      alt:       `Image ${i + 1}`,
      isPrimary: i === 0,
    })),
    thumbnailUrl:   photos[0] ? `${IMG_BASE}${photos[0].location}` : null,
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

// ─────────────────────────────────────────
// TRANSFORM DETAIL — нэг машины дэлгэрэнгүй
// ─────────────────────────────────────────
function transformDetail(c) {
  const base = transform(c);
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

module.exports = { transform, transformDetail };