const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type:     String,
    required: true,
    unique:   true,
    trim:     true,
    lowercase: true,
  },
  password: {
    type:     String,
    required: true,
    minlength: 6,
    select:   false, // query-д нуух
  },
  name:    { type: String, default: 'Admin' },
  isSuper: { type: Boolean, default: false },
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Нууц үгийг hash хийх
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Нууц үг шалгах
adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;