#!/usr/bin/env node
/**
 * fix-image-urls.js
 * Ажиллуулах: node fix-image-urls.js
 *
 * Database-д байгаа буруу зургийн URL-уудыг засна:
 * https://ci.encar.com/carpicture/carpicture03/... 
 *   → https://ci.encar.com/carpicture03/...
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log(' ЗУРГИЙН URL ЗАСАХ');
  console.log('═══════════════════════════════════════════\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB холбогдлоо\n');

  const db         = mongoose.connection.db;
  const collection = db.collection('vehicles');

  // Буруу URL-тай машинуудыг олох
  const total = await collection.countDocuments({
    'thumbnailUrl': { $regex: 'carpicture/carpicture' }
  });
  console.log(`📦 Засах машин: ${total}\n`);

  if (total === 0) {
    console.log('✅ Засах зүйл байхгүй байна.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  const cursor = collection.find({ 'thumbnailUrl': { $regex: 'carpicture/carpicture' } });

  for await (const doc of cursor) {
    // Зургийн URL-уудыг засах
    const fixedImages = (doc.images || []).map(img => ({
      ...img,
      url: (img.url || '').replace(
        'https://ci.encar.com/carpicture/carpicture',
        'https://ci.encar.com/carpicture'
      ),
    }));

    const fixedThumbnail = (doc.thumbnailUrl || '').replace(
      'https://ci.encar.com/carpicture/carpicture',
      'https://ci.encar.com/carpicture'
    );

    await collection.updateOne(
      { _id: doc._id },
      { $set: { images: fixedImages, thumbnailUrl: fixedThumbnail } }
    );
    updated++;

    if (updated % 100 === 0) {
      process.stdout.write(`\r  ⏳ ${updated} / ${total} ...`);
    }
  }

  console.log(`\n\n✅ ${updated} машины зургийн URL засагдлаа`);
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('MongoDB холболт хаагдлаа.');
}

main().catch(err => {
  console.error('❌ Алдаа:', err.message);
  process.exit(1);
});