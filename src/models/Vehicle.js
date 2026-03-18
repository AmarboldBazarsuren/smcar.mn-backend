const mongoose = require('mongoose');

const costItemSchema = new mongoose.Schema({
  label:  { type: String, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  // Encar өвөрмөц ID
  encarId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  // ══════════════════════════════════════
  // ҮНДСЭН МЭДЭЭЛЭЛ
  // ══════════════════════════════════════
  title:       { type: String, required: true },
  brand:       { type: String, required: true, index: true },
  model:       { type: String, required: true, index: true },
  badge:       { type: String },
  badgeDetail: { type: String },  // Encar BadgeDetail — жишээ: "고급형"
  year:        { type: Number, required: true, index: true },

  // ══════════════════════════════════════
  // ҮНЭ ТООЦООЛОЛ
  // ══════════════════════════════════════
  price:         { type: Number, required: true, index: true },
  originalPrice: { type: Number },

  wonToMnt:      { type: Number, default: 0 },
  basePriceMnt:  { type: Number, default: 0 },

  extraCosts: {
    type:    [costItemSchema],
    default: [],
  },

  totalPriceMnt: { type: Number, default: 0 },
  adminNote:     { type: String, default: '' },

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

  // ══════════════════════════════════════
  // ENCAR ТУСГАЙ ТАЛБАРУУД
  // ══════════════════════════════════════
  // Байгаль орчны тэмдэглэгээ: N=энгийн, H=хибрид, E=цахилгаан, P=PHEV
  greenType:  { type: String },

  // Шалгалт, баталгааны тэмдэглэгээ (Inspection, Record, Resume гэх мэт)
  condition:  [{ type: String }],

  // Итгэлийн тэмдэглэгээ (ExtendWarranty, HomeService гэх мэт)
  trust:      [{ type: String }],

  // Үйлчилгээний тэмдэглэгээ (EncarMeetgo, EncarDiagnosisP1 гэх мэт)
  serviceMark: [{ type: String }],

  // Худалдааны төрөл (일반, 리스, 렌트 гэх мэт)
  sellType:   { type: String },

  // Худалдан авалтын хэлбэр (Delivery гэх мэт)
  buyType:    [{ type: String }],

  // ══════════════════════════════════════
  // БАЙРШИЛ + ДИЛЕР
  // ══════════════════════════════════════
  location:       { type: String, index: true },
  locationDetail: { type: String },

  dealer: {
    id:       String,
    name:     String,
    rating:   Number,
    phone:    String,
    address:  String,
    verified: Boolean,
  },

  // ══════════════════════════════════════
  // ЗУРАГНУУД
  // ══════════════════════════════════════
  images: [{
    url:       String,
    alt:       String,
    isPrimary: { type: Boolean, default: false },
    isLocal:   { type: Boolean, default: false },
    filename:  String,
  }],
  thumbnailUrl: { type: String },

  // ══════════════════════════════════════
  // ОНЦЛОГ + ТАЙЛБАР
  // ══════════════════════════════════════
  features:    [{ type: String }],
  description: { type: String },

  // ══════════════════════════════════════
  // МАШИНЫ ТҮҮХ
  // ══════════════════════════════════════
  history: {
    accidents:      { type: Number, default: 0 },
    owners:         { type: Number, default: 1 },
    serviceRecords: { type: Boolean, default: false },
  },

  // ══════════════════════════════════════
  // СТАТУС + СТАТИСТИК
  // ══════════════════════════════════════
  status: {
    type:    String,
    enum:    ['active', 'sold', 'pending', 'hidden'],
    default: 'active',
    index:   true,
  },

  viewCount:     { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },

  // ══════════════════════════════════════
  // СИНК МЭДЭЭЛЭЛ
  // ══════════════════════════════════════
  isManual:       { type: Boolean, default: false },
  lastSyncedAt:   { type: Date, default: Date.now },
  encarCreatedAt: { type: Date },
  encarUpdatedAt: { type: Date },

}, {
  timestamps: true,
  toJSON:     { virtuals: true },
  toObject:   { virtuals: true },
});

// ── Индексүүд ──
vehicleSchema.index({ brand: 1, model: 1, year: 1 });
vehicleSchema.index({ price: 1, year: 1, mileage: 1 });
vehicleSchema.index({ '$**': 'text' });

// ── Virtual: Нийт MNT ──
vehicleSchema.virtual('computedTotalMnt').get(function () {
  if (!this.wonToMnt || !this.price) return this.totalPriceMnt || 0;
  const base  = this.price * this.wonToMnt;
  const extra = (this.extraCosts || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  return base + extra;
});

// ── Virtual: Үндсэн зураг ──
vehicleSchema.virtual('primaryImage').get(function () {
  if (!this.images?.length) return null;
  return (this.images.find(i => i.isPrimary) || this.images[0])?.url || null;
});

// ── Pre-save: totalPriceMnt автоматаар тооцоолох ──
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
  const set    = update?.$set || update || {};
  if (set.wonToMnt && set.price) {
    set.basePriceMnt  = Math.round(set.price * set.wonToMnt);
    const extraTotal  = (set.extraCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
    set.totalPriceMnt = set.basePriceMnt + extraTotal;
  }
  next();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;