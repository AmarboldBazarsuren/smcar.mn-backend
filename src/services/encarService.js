const { T }                        = require('./encar/translationHelpers');
const { transform, transformDetail } = require('./encar/encarTransformService');
const {
  getVehicles,
  getVehicleById,
  fetchAllVehicles,
  getMarketStats,
}                                  = require('./encar/encarFetchService');

// ─────────────────────────────────────────
// БРЭНДИЙН ЖАГСААЛТ (орчуулгын толиос)
// ─────────────────────────────────────────
function getBrands() {
  return {
    success: true,
    data: [...new Set(Object.values(T.brands))].map(n => ({ id: n, name: n })),
  };
}

// Stub-ууд (өргөтгөх боломжтой)
function getModelsByBrand() { return { success: true, data: [] }; }
function getPriceHistory()  { return { success: true, data: { price_history: [], trend: 'stable' } }; }
function getDealers()       { return { success: true, data: [] }; }

// ─────────────────────────────────────────
// EXPORT — хуучин нэгдсэн хэлбэрийг хадгалсан
// syncService нь transformVehicle() ашигладаг тул хэвээр байна
// ─────────────────────────────────────────
module.exports = {
  // Fetch
  getVehicles,
  getVehicleById,
  fetchAllVehicles,
  getMarketStats,

  // Transform (syncService дуудна)
  transformVehicle: transform,

  // Market helpers
  getBrands,
  getModelsByBrand,
  getPriceHistory,
  getDealers,
};