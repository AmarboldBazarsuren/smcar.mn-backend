#!/usr/bin/env node
// scripts/setup-admin.js
// Ажиллуулах: npm run setup
// Эсвэл:      node scripts/setup-admin.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise(r => rl.question(q, r));

async function setup() {
  console.log('\n═══════════════════════════════════════');
  console.log(' SMCar.mn — ADMIN ТОХИРУУЛАХ');
  console.log('═══════════════════════════════════════\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB холбогдлоо\n');

    // Admin model ачаалах
    const Admin = require('../src/models/Admin');
    const count = await Admin.countDocuments();

    if (count > 0) {
      const ans = await question('⚠️  Admin аль хэдийн байна. Шинэ нэмэх үү? (y/n): ');
      if (ans.toLowerCase() !== 'y') {
        console.log('Алгасав.');
        process.exit(0);
      }
    }

    const username = await question('Admin нэвтрэх нэр: ');
    const password = await question('Нууц үг (min 6 тэмдэгт): ');
    const name     = await question('Дэлгэцийн нэр (жишээ: Admin): ') || 'Admin';

    if (!username || password.length < 6) {
      console.log('❌ Нэвтрэх нэр эсвэл нууц үг буруу!');
      process.exit(1);
    }

    const admin = await Admin.create({
      username: username.toLowerCase().trim(),
      password,
      name:     name.trim(),
      isSuper:  count === 0,
    });

    console.log('\n✅ Admin амжилттай үүсгэгдлээ!');
    console.log(`   Нэвтрэх нэр : ${admin.username}`);
    console.log(`   Нэр         : ${admin.name}`);
    console.log(`   Super admin : ${admin.isSuper}`);
    console.log('\nAdmin panel: http://localhost:3000/admin/login\n');

  } catch (err) {
    console.error('❌ Алдаа:', err.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

setup();