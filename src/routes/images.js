// src/routes/images.js
const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const HEADERS = {
  'Referer':    'https://www.encar.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
};

const folderCache = new Map();

async function findFolder(encarId) {
  if (folderCache.has(encarId)) return folderCache.get(encarId);
  const prefix = encarId.substring(0, 4);
  for (let i = 1; i <= 10; i++) {
    const folder = String(i).padStart(2, '0');
    const url = `https://ci.encar.com/carpicture${folder}/pic${prefix}/${encarId}_001.jpg`;
    try {
      await axios.head(url, { timeout: 2000, headers: HEADERS });
      folderCache.set(encarId, folder);
      return folder;
    } catch {}
  }
  folderCache.set(encarId, null);
  return null;
}

// ─────────────────────────────────────────
// ЧУХАЛ: /list нь /:index-ийн ӨМНӨ байх ёстой
// /:index нь "list" гэсэн утгыг барьж авдаг тул
// ─────────────────────────────────────────

// GET /api/images/encar/:encarId/list
router.get('/encar/:encarId/list', async (req, res) => {
  const { encarId } = req.params;
  if (!/^\d+$/.test(encarId)) return res.json({ indexes: [], folder: null });

  const folder = await findFolder(encarId);
  if (!folder) return res.json({ indexes: [], folder: null });

  const prefix  = encarId.substring(0, 4);

  // 001-050 хүртэл зэрэг шалгана
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) => i + 1).map(async (i) => {
      const idx = String(i).padStart(3, '0');
      const url = `https://ci.encar.com/carpicture${folder}/pic${prefix}/${encarId}_${idx}.jpg`;
      try {
        await axios.head(url, { timeout: 2000, headers: HEADERS });
        return i;
      } catch {
        return null;
      }
    })
  );

  const indexes = results.filter(Boolean);
  res.json({ indexes, folder });
});

// GET /api/images/encar/:encarId/:index
router.get('/encar/:encarId/:index', async (req, res) => {
  const { encarId, index } = req.params;
  if (!/^\d+$/.test(encarId)) return res.status(400).end();

  const idx    = String(parseInt(index)).padStart(3, '0');
  const folder = await findFolder(encarId);
  if (!folder) return res.status(404).end();

  const prefix = encarId.substring(0, 4);
  const url    = `https://ci.encar.com/carpicture${folder}/pic${prefix}/${encarId}_${idx}.jpg`;

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout:      5000,
      headers:      HEADERS,
    });
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 404).end();
  }
});

module.exports = router;