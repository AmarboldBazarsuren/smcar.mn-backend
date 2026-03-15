const mongoose = require('mongoose');

// Extra cost item (дахин тооцоолол)
const costItemSchema = new mongoose.Schema({
  label:  { type: String, required: true }, // "Тээврийн зардал", "Татвар" гэх мэт
  amount: { type: Number, required: true }, // MNT дүн
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  // Encar-аас ирэх өвөрмөц ID
  encarId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Үндсэн мэдээлэл
  title:  { type: String, required: true },
  brand:  { type: String, required: true, index: true },
  model:  { type: String, required: true, index: true },
  badge:  { type: String },
  year:   { type: Number, required: true, index: true },

  // ══════════════════════════════════════
  // ҮНЭ ТООЦООЛОЛ
  // ══════════════════════════════════════
  // Солонгос вон (₩) — Encar-аас ирсэн
  price:         { type: Number, required: true, index: true },
  originalPrice: { type: Number },

  // MNT тооцоолол — Admin оруулна
  wonToMnt:      { type: Number, default: 0 },    // 1 WON = X MNT (admin оруулна)
  basePriceMnt:  { type: Number, default: 0 },    // price * wonToMnt

  // Нэмэлт зардлууд (Admin нэмнэ)
  extraCosts: {
    type: [costItemSchema],
    default: [],
  },

  // Нийт үнэ MNT-ээр (автоматаар тооцоолно)
  totalPriceMnt: { type: Number, default: 0 },

  // Admin тайлбар
  adminNote: { type: String, default: '' },

  // ══════════════════════════════════════
  // ТЕХНИКИЙН МЭДЭЭЛЭЛ
  // ══════════════════════════════════════
  mileage:      { type: Number, index: true },
  fuelType:     { type: String },
  transmission: { type: String },
  engineSize:   { type: String },
  bodyType:     { type: String },
  color:        { type: String },
  doors:        { type: Number },
  seats:        { type: Number },

  // Байршил
  location:       { type: String, index: true },
  locationDetail: { type: String },

  // Дилер
  dealer: {
    id:       String,
    name:     String,
    rating:   Number,
    phone:    String,
    address:  String,
    verified: Boolean,
  },

  // Зурагнууд
  images: [{
    url:       String,
    alt:       String,
    isPrimary: { type: Boolean, default: false },
    isLocal:   { type: Boolean, default: false }, // Admin upload хийсэн зураг
    filename:  String,
  }],
  thumbnailUrl: { type: String },

  // Онцлогууд, тайлбар
  features:    [{ type: String }],
  description: { type: String },

  // Түүх
  history: {
    accidents:      { type: Number, default: 0 },
    owners:         { type: Number, default: 1 },
    serviceRecords: { type: Boolean, default: false },
  },

  // Статус
  status: {
    type: String,
    enum: ['active', 'sold', 'pending', 'hidden'],
    default: 'active',
    index: true,
  },

  // Статистик
  viewCount:     { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },

  // Синк мэдээлэл
  isManual:      { type: Boolean, default: false }, // Admin гараар нэмсэн эсэх
  lastSyncedAt:  { type: Date, default: Date.now },
  encarCreatedAt: { type: Date },
  encarUpdatedAt: { type: Date },

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// Индексүүд
vehicleSchema.index({ brand: 1, model: 1, year: 1 });
vehicleSchema.index({ price: 1, year: 1, mileage: 1 });
vehicleSchema.index({ '$**': 'text' });

// Virtual: Нийт MNT үнийг автоматаар тооцоолох
vehicleSchema.virtual('computedTotalMnt').get(function () {
  if (!this.wonToMnt || !this.price) return this.totalPriceMnt || 0;
  const base = this.price * this.wonToMnt;
  const extra = (this.extraCosts || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  return base + extra;
});

// Pre-save: totalPriceMnt-ийг автоматаар тооцоолох
vehicleSchema.pre('save', function (next) {
  if (this.wonToMnt && this.price) {
    this.basePriceMnt  = Math.round(this.price * this.wonToMnt);
    const extraTotal   = (this.extraCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
    this.totalPriceMnt = this.basePriceMnt + extraTotal;
  }
  next();
});

vehicleSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const set = update?.$set || update || {};
  if (set.wonToMnt && set.price) {
    set.basePriceMnt  = Math.round(set.price * set.wonToMnt);
    const extraTotal  = (set.extraCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
    set.totalPriceMnt = set.basePriceMnt + extraTotal;
  }
  next();
});

// Virtual: Үндсэн зураг
vehicleSchema.virtual('primaryImage').get(function () {
  if (!this.images?.length) return null;
  return (this.images.find(i => i.isPrimary) || this.images[0])?.url || null;
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;