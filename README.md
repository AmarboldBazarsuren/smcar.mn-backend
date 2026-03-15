# 🚗 Car Marketplace - Backend

Encar.com API-тай холбогдсон машин худалдааны платформын backend сервер.

## 🏗️ Технологи

- **Node.js + Express** — API сервер
- **MongoDB + Mongoose** — Өгөгдлийн сан
- **node-cron** — Автомат синк (цаг тутамд шинэчлэгдэнэ)
- **Axios** — Encar API-тай харилцах
- **Winston** — Логгинг

---

## ⚡ Хурдан эхлэх

### 1. Суулгах

```bash
cd backend
npm install
```

### 2. Тохиргоо хийх

```bash
cp .env.example .env
```

`.env` файлыг нээж дараах мэдээллийг оруулна:

```env
MONGODB_URI=mongodb://localhost:27017/car_marketplace
CARAPIS_API_KEY=таны_api_түлхүүр
```

> **API Түлхүүр авах:** https://carapis.com дээр бүртгүүлж API key аваарай

### 3. MongoDB суулгах (хэрэв байхгүй бол)

**Windows:**
```
https://www.mongodb.com/try/download/community
```

**Mac:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Docker ашиглах бол:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Серверийг эхлүүлэх

```bash
# Development горим (автомат дахин эхлүүлнэ)
npm run dev

# Production горим
npm start
```

---

## 📡 API Endpoint-ууд

### Машинууд

| Method | URL | Тайлбар |
|--------|-----|---------|
| GET | `/api/vehicles` | Машины жагсаалт |
| GET | `/api/vehicles/:id` | Нэг машины дэлгэрэнгүй |
| GET | `/api/vehicles/featured` | Онцлох машинууд |
| GET | `/api/vehicles/stats` | Статистик |
| GET | `/api/vehicles/:id/price-history` | Үнийн түүх |

### Машин шүүх параметрүүд

```
GET /api/vehicles?brand=Hyundai&year_min=2020&price_max=30000000&limit=20&page=1
```

| Параметр | Тайлбар | Жишээ |
|----------|---------|-------|
| `brand` | Брэнд | `Hyundai` |
| `model` | Загвар | `Sonata` |
| `year_min` | Доод он | `2020` |
| `year_max` | Дээд он | `2024` |
| `price_min` | Доод үнэ | `5000000` |
| `price_max` | Дээд үнэ | `30000000` |
| `fuel_type` | Түлш | `Gasoline` |
| `transmission` | Хурд | `Automatic` |
| `location` | Байршил | `Seoul` |
| `search` | Текст хайлт | `Sonata 2022` |
| `sort` | Эрэмбэлэх | `-price`, `year`, `-createdAt` |
| `page` | Хуудас | `1` |
| `limit` | Тоо хэмжээ | `20` |

### Захын мэдээлэл

| Method | URL | Тайлбар |
|--------|-----|---------|
| GET | `/api/market/brands` | Брэнд жагсаалт |
| GET | `/api/market/models/:brand` | Брэндийн загварууд |
| GET | `/api/market/stats` | Захын статистик |
| POST | `/api/market/sync` | Гараар синк эхлүүлэх |
| GET | `/api/market/sync/status` | Синкийн статус |

---

## 🔄 Автомат Синк

Сервер эхлэхэд автоматаар Encar.com-оос машинуудыг татаж MongoDB-д хадгалдаг.

- **Давтамж:** 30 минут тутамд (`.env`-д өөрчлөх боломжтой)
- **Шинэ машин:** Автоматаар нэмэгдэнэ
- **Зарагдсан машин:** `sold` статус болно
- **Лог:** `logs/` фолдерт хадгалагдана

```env
# 30 минут тутамд синк хийх
SYNC_INTERVAL_MINUTES=30

# Нэг batch-д 100 машин татах
SYNC_BATCH_SIZE=100
```

---

## 🏥 Health Check

```
GET http://localhost:5000/health
```

---

## 📁 Файлын бүтэц

```
backend/
├── src/
│   ├── config/
│   │   └── database.js        # MongoDB холболт
│   ├── controllers/
│   │   ├── vehicleController.js  # Машины endpoint логик
│   │   └── marketController.js   # Захын endpoint логик
│   ├── models/
│   │   ├── Vehicle.js         # MongoDB схем
│   │   └── SyncLog.js         # Синкийн лог
│   ├── routes/
│   │   ├── vehicles.js        # /api/vehicles
│   │   └── market.js          # /api/market
│   ├── services/
│   │   ├── encarService.js    # Encar API клиент
│   │   └── syncService.js     # Автомат синк
│   ├── middleware/
│   │   └── errorHandler.js    # Алдаа боловсруулалт
│   ├── utils/
│   │   └── logger.js          # Winston лог
│   └── app.js                 # Үндсэн app
├── logs/                      # Лог файлууд
├── .env.example               # Тохиргооны загвар
├── package.json
└── README.md
```
