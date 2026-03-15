#!/usr/bin/env node
/**
 * migrate-translations.js
 * Ажиллуулах: node migrate-translations.js
 * 
 * MongoDB-д байгаа бүх машины солонгос нэрсийг англи руу орчуулна.
 * Нэг удаа л ажиллуулна.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');

// ── Орчуулгын толь ачаалах ──
let T = { brands: {}, models: {}, suffixes: {}, fuel_types: {}, transmissions: {}, body_types: {}, colors: {}, regions: {} };
try {
  T = require(path.join(__dirname, 'carTranslations.json'));
  console.log('✅ carTranslations.json ачаалагдлаа');
} catch (e) {
  console.error('❌ carTranslations.json олдсонгүй:', e.message);
  process.exit(1);
}

// ── Helper functions (encarService-тэй ижил) ──
function hasKorean(str) {
  return str && /[가-힣]/.test(str);
}

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function replaceKoreanWords(text) {
  if (!text) return text;
  let result = text;

  for (const [ko, en] of Object.entries(T.suffixes || {})) {
    if (ko.length > 1) {
      result = result.replace(new RegExp(escapeRegex(ko), 'g'), en);
    }
  }
  for (const [ko, en] of Object.entries(T.fuel_types || {})) {
    if (/[가-힣]/.test(ko)) {
      result = result.replace(new RegExp(escapeRegex(ko), 'g'), en);
    }
  }
  return result.trim();
}

function mapBrand(raw) {
  if (!raw) return raw;
  return lookup(T.brands, raw) || raw.trim();
}

function mapModel(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();

  const direct = lookup(T.models, trimmed);
  if (direct) return direct;

  let best = '', bestLen = 0;
  for (const [ko, en] of Object.entries(T.models)) {
    if (hasKorean(ko) && trimmed.startsWith(ko) && ko.length > bestLen) {
      best = en; bestLen = ko.length;
    }
  }
  if (best) {
    const rest = trimmed.slice(bestLen).trim();
    const cleanRest = replaceKoreanWords(rest);
    return cleanRest ? `${best} ${cleanRest}`.trim() : best;
  }

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
  if (!raw) return raw;
  return lookup(T.fuel_types, raw) || raw;
}

function mapTrans(raw) {
  if (!raw) return raw;
  return lookup(T.transmissions, raw) || raw;
}

function mapBody(raw) {
  if (!raw) return raw;
  return lookup(T.body_types, raw) || raw;
}

function mapColor(raw) {
  if (!raw) return raw;
  return lookup(T.colors, raw) || (hasKorean(raw) ? replaceKoreanWords(raw) : raw);
}

function mapRegion(raw) {
  if (!raw) return raw;
  return lookup(T.regions, raw) || (hasKorean(raw) ? replaceKoreanWords(raw) : raw);
}

// ── Main migration ──
async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log(' МАШИНЫ НЭР ОРЧУУЛАХ MIGRATION');
  console.log('═══════════════════════════════════════════\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB холбогдлоо\n');

    const db = mongoose.connection.db;
    const collection = db.collection('vehicles');

    const total = await collection.countDocuments();
    console.log(`📦 Нийт ${total} машин олдлоо\n`);

    let updated = 0, skipped = 0, errors = 0;
    const cursor = collection.find({});
    const batchSize = 100;
    let batch = [];

    const processBatch = async (docs) => {
      const ops = [];

      for (const doc of docs) {
        try {
          const newBrand  = mapBrand(doc.brand);
          const newModel  = mapModel(doc.model);
          const newBadge  = mapBadge(doc.badge);
          const newFuel   = mapFuel(doc.fuelType);
          const newTrans  = mapTrans(doc.transmission);
          const newBody   = mapBody(doc.bodyType);
          const newColor  = mapColor(doc.color);
          const newLoc    = mapRegion(doc.location);

          const newTitle  = [newBrand, newModel, newBadge, doc.year].filter(Boolean).join(' ').trim();

          // Өөрчлөгдсөн талбар байгаа эсэх шалгах
          const changed =
            newBrand  !== doc.brand  ||
            newModel  !== doc.model  ||
            newBadge  !== doc.badge  ||
            newFuel   !== doc.fuelType ||
            newTrans  !== doc.transmission ||
            newBody   !== doc.bodyType ||
            newColor  !== doc.color  ||
            newLoc    !== doc.location ||
            newTitle  !== doc.title;

          if (!changed) { skipped++; continue; }

          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: {
                  brand:        newBrand,
                  model:        newModel,
                  badge:        newBadge,
                  fuelType:     newFuel,
                  transmission: newTrans,
                  bodyType:     newBody,
                  color:        newColor,
                  location:     newLoc,
                  title:        newTitle,
                  'dealer.address': newLoc,
                }
              }
            }
          });
          updated++;
        } catch (err) {
          errors++;
          console.error(`  ❌ Алдаа (${doc._id}): ${err.message}`);
        }
      }

      if (ops.length > 0) {
        await collection.bulkWrite(ops, { ordered: false });
      }
    };

    let docBatch = [];
    for await (const doc of cursor) {
      docBatch.push(doc);
      if (docBatch.length >= batchSize) {
        await processBatch(docBatch);
        docBatch = [];
        process.stdout.write(`\r  ⏳ ${updated + skipped + errors} / ${total} ...`);
      }
    }
    if (docBatch.length > 0) await processBatch(docBatch);

    console.log('\n');
    console.log('═══════════════════════════════════════════');
    console.log('✅ MIGRATION ДУУСЛАА');
    console.log(`   📝 Орчуулагдсан : ${updated}`);
    console.log(`   ⏭  Өөрчлөгдөөгүй: ${skipped}`);
    console.log(`   ❌ Алдаа        : ${errors}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Алдаа:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB холболт хаагдлаа.');
  }
}

main();