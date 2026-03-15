const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['auto', 'manual', 'initial'],
    default: 'auto',
  },
  status: {
    type: String,
    enum: ['running', 'success', 'failed'],
    default: 'running',
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  stats: {
    totalFetched: { type: Number, default: 0 },
    newVehicles: { type: Number, default: 0 },
    updatedVehicles: { type: Number, default: 0 },
    removedVehicles: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
  },

  errorMessage: { type: String },
  duration: { type: Number }, // milliseconds
}, {
  timestamps: true,
});

const SyncLog = mongoose.model('SyncLog', syncLogSchema);
module.exports = SyncLog;
