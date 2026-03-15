const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Encar-аас ирэх өвөрмөц ID
  encarId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Үндсэн мэдээлэл
  title: { type: String, required: true },
  brand: { type: String, required: true, index: true },
  model: { type: String, required: true, index: true },
  year: { type: Number, required: true, index: true },
  
  // Үнэ (Солонгос вон, ₩)
  price: { type: Number, required: true, index: true },
  originalPrice: { type: Number },
  priceKrw: { type: Number }, // Эх үнэ

  // Техникийн мэдээлэл
  mileage: { type: Number, index: true },        // км
  fuelType: { type: String },                    // Gasoline, Diesel, Electric, Hybrid
  transmission: { type: String },                // Automatic, Manual
  engineSize: { type: String },                  // 2.0L, 2.5L...
  bodyType: { type: String },                    // Sedan, SUV, Hatchback...
  color: { type: String },
  doors: { type: Number },
  seats: { type: Number },

  // Байршил
  location: { type: String, index: true },
  locationDetail: { type: String },

  // Дилерийн мэдээлэл
  dealer: {
    id: String,
    name: String,
    rating: Number,
    phone: String,
    address: String,
  },

  // Зурагнууд
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false },
  }],
  thumbnailUrl: { type: String },

  // Онцлогууд
  features: [{ type: String }],

  // Тайлбар
  description: { type: String },

  // Түүх
  history: {
    accidents: { type: Number, default: 0 },
    owners: { type: Number, default: 1 },
    serviceRecords: { type: Boolean, default: false },
  },

  // Статус
  status: {
    type: String,
    enum: ['active', 'sold', 'pending', 'hidden'],
    default: 'active',
    index: true,
  },

  // Үзэлт тоолуур
  viewCount: { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },

  // Синк мэдээлэл
  lastSyncedAt: { type: Date, default: Date.now },
  encarCreatedAt: { type: Date },
  encarUpdatedAt: { type: Date },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Хайлтын индекс
vehicleSchema.index({ brand: 1, model: 1, year: 1 });
vehicleSchema.index({ price: 1, year: 1, mileage: 1 });
vehicleSchema.index({ '$**': 'text' }); // Full-text хайлт

// Virtual: Үнийн форматтай хувилбар
vehicleSchema.virtual('priceFormatted').get(function () {
  if (!this.price) return '0₩';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(this.price);
});

// Virtual: Голлох зураг
vehicleSchema.virtual('primaryImage').get(function () {
  if (!this.images || this.images.length === 0) return null;
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : this.images[0].url;
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;
