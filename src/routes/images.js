// src/routes/images.js
const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const HEADERS = {
  'Referer':    'https://www.encar.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
};

// Зургийн URL-ийг тодорхойлох
// carpicture01 эсвэл carpicture02 — аль нь ажиллахыг туршина
function buildUrls(encarId, idx) {
  const prefix = encarId.substring(0, 4);
  return [
    `https://ci.encar.com/carpicture01/pic${prefix}/${encarId}_${idx}.jpg`,
    `https://ci.encar.com/carpicture02/pic${prefix}/${encarId}_${idx}.jpg`,
  ];
}

// GET /api/images/encar/:encarId/:index
router.get('/encar/:encarId/:index', async (req, res) => {
  const { encarId, index } = req.params;

  if (!/^\d+$/.test(encarId)) return res.status(400).end();

  const idx  = String(parseInt(index)).padStart(3, '0');
  const urls = buildUrls(encarId, idx);

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 8000,
        headers: HEADERS,
      });

      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      response.data.pipe(res);
      return; // амжилттай → зогсоно

    } catch (err) {
      if (err.response?.status !== 404) {
        // 404 биш алдаа — дараагийн URL-ийг туршихгүй
        return res.status(502).end();
      }
      // 404 → дараагийн URL-ийг туршина
    }
  }

  // Хоёулаа 404
  res.status(404).end();
});

// GET /api/images/encar/:encarId/folder
// Тухайн машины зөв folder-ийг олох (01 эсвэл 02)
router.get('/encar/:encarId/folder', async (req, res) => {
  const { encarId } = req.params;
  if (!/^\d+$/.test(encarId)) return res.json({ folder: '01' });

  const prefix = encarId.substring(0, 4);
  const url01  = `https://ci.encar.com/carpicture01/pic${prefix}/${encarId}_001.jpg`;
  const url02  = `https://ci.encar.com/carpicture02/pic${prefix}/${encarId}_001.jpg`;

  try {
    await axios.head(url01, { timeout: 5000, headers: HEADERS });
    return res.json({ folder: '01', encarId });
  } catch {}

  try {
    await axios.head(url02, { timeout: 5000, headers: HEADERS });
    return res.json({ folder: '02', encarId });
  } catch {}

  res.json({ folder: null, encarId }); // зураг байхгүй
});

module.exports = router;