import axios from 'axios'

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Auth token нэмэх
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken')
      if (window.location.pathname.startsWith('/admin') &&
          window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err.response?.data?.message || err.message || 'Алдаа гарлаа')
  }
)

// ── Vehicles ──
export const vehicleAPI = {
  list:     (params) => api.get('/vehicles',          { params }),
  getById:  (id)     => api.get(`/vehicles/${id}`),
  featured: (limit=8)=> api.get('/vehicles/featured', { params: { limit } }),
  stats:    ()       => api.get('/vehicles/stats'),
}

// ── Admin ──
export const adminAPI = {
  login:    (data)   => api.post('/admin/login', data),
  getMe:    ()       => api.get('/admin/me'),
  getStats: ()       => api.get('/admin/stats'),

  // Vehicles
  listVehicles:   (params) => api.get('/admin/vehicles', { params }),
  createVehicle:  (data)   => api.post('/admin/vehicles', data),
  updateVehicle:  (id, data) => api.put(`/admin/vehicles/${id}`, data),
  deleteVehicle:  (id)     => api.delete(`/admin/vehicles/${id}`),

  // Pricing
  updatePricing:  (id, data) => api.put(`/admin/vehicles/${id}/pricing`, data),
  globalRate:     (data)   => api.post('/admin/pricing/global', data),

  // Image
  deleteImage:    (id, idx)  => api.delete(`/admin/vehicles/${id}/images/${idx}`),

  // Setup
  setup:          (data)   => api.post('/admin/setup', data),
}

// ── Market ──
export const marketAPI = {
  brands:      ()      => api.get('/market/brands'),
  models:      (brand) => api.get(`/market/models/${brand}`),
  syncStatus:  ()      => api.get('/market/sync/status'),
  triggerSync: ()      => api.post('/market/sync'),
}

// ═══════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════

// Солонгос вон форматлах
export const formatKRW = (won) => {
  if (!won) return '—'
  const man = Math.round(won / 10000)
  return `₩${man.toLocaleString()}만`
}

// MNT форматлах
export const formatMNT = (mnt) => {
  if (!mnt) return '—'
  return `${mnt.toLocaleString()}₮`
}

// Машины нийт MNT үнэ (computed)
export const getDisplayPrice = (car) => {
  if (car.totalPriceMnt > 0) return formatMNT(car.totalPriceMnt)
  if (car.wonToMnt > 0 && car.price > 0) return formatMNT(Math.round(car.price * car.wonToMnt))
  return formatKRW(car.price)
}

// Нийт зардлын задаргаа
export const getPriceBreakdown = (car) => {
  if (!car.wonToMnt || !car.price) return null

  const base  = Math.round(car.price * car.wonToMnt)
  const extra = (car.extraCosts || []).reduce((s, c) => s + (c.amount || 0), 0)
  const total = base + extra

  return {
    basePriceMnt:  base,
    extraCosts:    car.extraCosts || [],
    totalPriceMnt: total,
    wonToMnt:      car.wonToMnt,
    priceKrw:      car.price,
  }
}

// Явсан зам
export const formatMileage = (km) => {
  if (!km) return '—'
  return `${km.toLocaleString()} км`
}

// Машины нас
export const carAge = (year) => {
  if (!year) return ''
  const age = new Date().getFullYear() - year
  return age === 0 ? 'Шинэ' : `${age} жилтэй`
}

// Fuel type монголоор
export const fuelTypeLabel = {
  'Gasoline': 'Бензин',
  'Diesel':   'Дизель',
  'Electric': 'Цахилгаан',
  'Hybrid':   'Хибрид',
  'LPG':      'Шингэн хий',
}

// Transmission монголоор
export const transmissionLabel = {
  'Automatic': 'Автомат',
  'Manual':    'Механик',
  'A':         'Автомат',
  'M':         'Механик',
}

// Fuel өнгө
export const fuelColor = {
  'Gasoline': '#F59E0B',
  'Diesel':   '#3B7AFF',
  'Electric': '#22C55E',
  'Hybrid':   '#10B981',
  'LPG':      '#8B5CF6',
}

// Image URL бүрдүүлэх
export const getImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `http://localhost:5000${url}`
}

export default api