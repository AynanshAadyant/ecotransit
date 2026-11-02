# Eco-Transit Admin & Staff Backend

A high-performance, resilient **Node.js + Express.js** backend service for the **Eco-Transit** public transportation management system. Built specifically for **Admin and Staff** operations with real-time IoT GPS tracking, Redis transient caching, PostGIS spatial indexing, and WebSocket live broadcasting.

---

## 📋 Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Docker Compose Setup (PostgreSQL, Redis, Mosquitto)](#docker-compose-setup)
7. [Environment Variables](#environment-variables)
8. [Database Schema & Migrations](#database-schema--migrations)
9. [Default Seed Credentials](#default-seed-credentials)
10. [Starting the Application](#starting-the-application)
11. [Running Automated Tests](#running-automated-tests)
12. [Simulating ESP32 GPS Feeds](#simulating-esp32-gps-feeds)
13. [API Endpoints Reference](#api-endpoints-reference)
14. [Real-Time WebSocket Events](#real-time-websocket-events)
15. [MQTT Ingestion & Payload Specification](#mqtt-ingestion--payload-specification)
16. [Security & Optimization Details](#security--optimization-details)

---

## 🚀 Features

* **Role-Based Access Control (RBAC):** Clean separation of privileges between `ADMIN` (system configuration, staff, routes, stops, vehicles, incident management) and `STAFF` (driver/operator dashboard, trip workflows, vehicle status monitoring, incident reporting).
* **Robust JWT Authentication:** bcrypt password hashing (10 salt rounds), secure token issuance, context verification, and automatic password hash exclusion in API payloads.
* **Spatial Geography with PostGIS:** Real geographic coordinate indexing for transit stops, routes, incident locations, and GPS tracking points using `GEOMETRY(Point, 4326)` and spatial GiST indices.
* **Real-Time IoT GPS Ingestion via MQTT:** Validates ESP32 + NEO-6M telemetry payloads, rejects invalid fixes (such as 0,0), caches latest positions in Redis with TTL heartbeats, and broadcasts live coordinates to dashboards without frontend polling.
* **Smart Database Persistence Strategy:** Prevents PostgreSQL database flooding during frequent (1-second) GPS pings by using adaptive persistence (triggers only when vehicle moves $\ge$ 50m, interval $\ge$ 15s, or when active trips are underway).
* **Live Dashboards:** Distinct statistical analytics for Administrators and operational overview for field Staff.
* **Zero-Friction Fallback:** Built with automatic resilient failover for Redis and PostgreSQL (using in-memory `pg-mem`), allowing immediate development and testing even before external database servers are started.

---

## 🛠 Technology Stack

* **Runtime:** Node.js (v18+)
* **Framework:** Express.js
* **Database:** PostgreSQL 16 + PostGIS (Spatial extension)
* **In-Memory Store:** Redis 7 (Latest vehicle coordinates, online/offline status, TTL tracking)
* **Authentication:** JSON Web Tokens (`jsonwebtoken`) + `bcryptjs`
* **Real-Time WebSockets:** Socket.IO
* **IoT Protocol:** MQTT (`mqtt.js` subscriber + optional embedded `aedes` broker)
* **Security & Reliability:** `helmet`, `cors`, `express-rate-limit`, centralized error handling

---

## 🏛 Architecture Overview

```text
       [ ESP32 + NEO-6M GPS Device ]
                    │
                    ▼ (MQTT publish to: ecotransit/vehicles/:id/gps)
           [ MQTT Broker: 1883 ]
                    │
                    ▼
         [ Node.js MQTT Subscriber ]
                    │
           ┌────────┴────────┐
           ▼                 ▼
   (Validate Payload)   (Reject Invalid Fixes e.g. 0,0)
           │
           ├───────────────────────────────┐
           ▼                               ▼
    [ Redis Cache ]               [ Smart DB Filter ]
  vehicle:{id}:location            Interval >= 15s OR
  vehicle:{id}:status (TTL)        Distance >= 50m
           │                               │
           ▼                               ▼
 [ WebSocket (Socket.IO) ]     [ PostgreSQL + PostGIS ]
           │                         gps_logs table
           ▼
[ Admin & Staff Dashboards ]
```

---

## 📦 Project Directory Structure

```text
backend/
├── database/
│   ├── schema.sql         # PostgreSQL + PostGIS table schema & spatial indices
│   └── seeds.sql          # Sample transit routes, stops, vehicles, and seed users
├── src/
│   ├── config/
│   │   ├── db.js          # Resilient PostgreSQL pool & in-memory fallback
│   │   └── redis.js       # Redis client with transient memory cache fallback
│   ├── controllers/
│   │   ├── admin.controller.js
│   │   ├── auth.controller.js
│   │   └── staff.controller.js
│   ├── middleware/
│   │   ├── auth.js        # authenticate() & authorize(...roles)
│   │   ├── errorHandler.js# Centralized error responses
│   │   └── rateLimiter.js # IP rate limiting for API and Auth
│   ├── mqtt/
│   │   ├── broker.js      # Embedded Aedes MQTT broker
│   │   ├── index.js       # MQTT initialization
│   │   ├── simulator.js   # ESP32 GPS simulator script
│   │   └── subscriber.js  # Telemetry validator and processor
│   ├── routes/
│   │   ├── admin.routes.js# Protected /api/admin/* endpoints
│   │   ├── auth.routes.js # Public /api/auth/login, protected /me
│   │   ├── index.js       # Main router mount & /api/health
│   │   └── staff.routes.js# Protected /api/staff/* endpoints
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── dashboard.service.js
│   │   ├── gps.service.js
│   │   ├── incident.service.js
│   │   ├── route.service.js
│   │   ├── staff.service.js
│   │   ├── stop.service.js
│   │   ├── trip.service.js
│   │   └── vehicle.service.js
│   ├── utils/
│   │   ├── initDb.js      # Script to initialize database schema
│   │   ├── jwt.js         # JWT signing and verification
│   │   ├── password.js    # bcrypt hashing and comparison
│   │   ├── response.js    # Standard success and error responses
│   │   └── seedDb.js      # Script to seed database records
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── common.js
│   │   ├── gps.validator.js
│   │   ├── incident.validator.js
│   │   ├── route.validator.js
│   │   ├── staff.validator.js
│   │   ├── stop.validator.js
│   │   ├── trip.validator.js
│   │   └── vehicle.validator.js
│   ├── websocket/
│   │   └── index.js       # Socket.IO event broadcaster & room manager
│   ├── app.js             # Express application setup
│   └── server.js          # Server entrypoint
├── tests/
│   └── run-tests.js       # End-to-end automated test runner (57 test assertions)
├── .env.example
├── docker-compose.yml
└── package.json
```

---

## ⚙️ Prerequisites

* **Node.js:** v18.x, v20.x, or v22+
* **npm:** v9+
* *(Optional for Docker mode)*: Docker Desktop / Docker Engine

---

## 🔧 Installation & Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

---

## 🐳 Docker Compose Setup

To start PostgreSQL with PostGIS, Redis, and Eclipse Mosquitto MQTT broker using Docker:

```bash
docker compose up -d
```

This starts:
* **PostgreSQL + PostGIS** on port `5432` (database `ecotransit`, user `postgres`, password `postgres`)
* **Redis** on port `6379`
* **Mosquitto MQTT Broker** on port `1883`

---

## 🔐 Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port for Express & Socket.IO server |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `CLIENT_URL` | `*` | Allowed CORS origins (comma-separated URLs) |
| `JWT_SECRET` | *(Random string)* | Secret key for signing JSON Web Tokens |
| `JWT_EXPIRES_IN` | `24h` | Token expiration time |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `ecotransit` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | MQTT broker connection URL |
| `MQTT_GPS_TOPIC` | `ecotransit/vehicles/+/gps` | Topic subscription wildcard for GPS ingestion |
| `EMBEDDED_MQTT_ENABLED` | `true` | Runs an in-process Aedes MQTT broker if port 1883 is free |
| `GPS_DB_WRITE_INTERVAL_SEC` | `15` | Minimum seconds between DB writes for a single vehicle |
| `GPS_DB_MIN_DISTANCE_METERS` | `50` | Minimum meters moved before triggering an immediate DB write |
| `VEHICLE_OFFLINE_TIMEOUT_SEC` | `90` | Inactivity window before marking vehicle offline in Redis |

---

## 🗄 Database Schema & Migrations

To apply the schema and seed data manually to a running PostgreSQL database:

```bash
# Initialize schema tables, constraints, and PostGIS indexes
npm run db:init

# Seed initial admin, staff, sample routes, stops, and vehicles
npm run db:seed
```

---

## 🔑 Default Seed Credentials

| Role | Email | Password | Phone |
|---|---|---|---|
| **ADMIN** | `admin@ecotransit.org` | `AdminPassword@123` | `+919876543210` |
| **STAFF** | `ramesh.staff@ecotransit.org` | `StaffPassword@123` | `+919811223344` |
| **STAFF** | `priya.staff@ecotransit.org` | `StaffPassword@123` | `+919822334455` |

---

## 🏃 Starting the Application

### Production / Standard Mode:
```bash
npm start
```

### Development Mode (auto-restart on file change):
```bash
npm run dev
```

Server endpoints will be active on:
* **Base API:** `http://localhost:5000/api`
* **Health Check:** `http://localhost:5000/api/health`

---

## 🧪 Running Automated Tests

A comprehensive integration test suite verifies database operations, authentication, RBAC boundaries, Admin/Staff CRUD, real-time GPS ingestion, Redis caching, and WebSockets:

```bash
npm test
```

---

## 📡 Simulating ESP32 GPS Feeds

To simulate an ESP32 microcontroller with a NEO-6M GPS module transmitting live coordinates along the Delhi transit corridor:

```bash
npm run simulate:gps
```

This publishes continuous JSON payloads to MQTT topic `ecotransit/vehicles/1/gps` with realistic speeds, headings, and coordinate jitter.

---

## 📖 API Endpoints Reference

### Standard Response Format

**Success Response (HTTP 200/201):**
```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": {}
}
```

**Error Response (HTTP 400/401/403/404/409/500):**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "errors": []
}
```

---

### 1. Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates user (email/username + password), returns JWT & role |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated user profile |

**Example Login Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@ecotransit.org",
    "password": "AdminPassword@123"
  }'
```

---

### 2. Admin APIs (`/api/admin`) — Requires `ADMIN` Role

#### Dashboard
* `GET /api/admin/dashboard` — Statistics: totalVehicles, activeVehicles, inactiveVehicles, activeTrips, totalStaff, openIncidents, offlineDevices, recentIncidents.

#### Staff Management
* `GET /api/admin/staff` — List staff accounts
* `POST /api/admin/staff` — Create staff account (`name`, `email`, `password`, `phone`, `role`, `status`)
* `GET /api/admin/staff/:id` — Get staff details
* `PATCH /api/admin/staff/:id` — Update staff details
* `DELETE /api/admin/staff/:id` — Remove staff account

#### Vehicles Management
* `GET /api/admin/vehicles` — List vehicles (enriched with real-time Redis coordinates/status)
* `POST /api/admin/vehicles` — Register vehicle (`vehicleNumber`, `registrationNumber`, `vehicleType`, `capacity`, `routeId`, `deviceId`, `status`)
* `GET /api/admin/vehicles/:id` — Detailed vehicle information & live GPS position
* `PATCH /api/admin/vehicles/:id` — Update vehicle
* `DELETE /api/admin/vehicles/:id` — Remove vehicle

#### Routes & Stops Management
* `GET /api/admin/routes` — List transit routes
* `POST /api/admin/routes` — Create route with ordered stops (`name`, `routeCode`, `origin`, `destination`, `distanceKm`, `stops: [{ stopId, stopOrder }]`)
* `GET /api/admin/routes/:id` — Get route details with ordered sequence of stops
* `PATCH /api/admin/routes/:id` — Update route
* `DELETE /api/admin/routes/:id` — Remove route
* `POST /api/admin/routes/:id/stops` — Re-order or assign stops to route
* `GET /api/admin/stops` — List all transit stops
* `POST /api/admin/stops` — Create stop (`name`, `stopCode`, `latitude`, `longitude`, `address`, `status`)
* `GET /api/admin/stops/:id` — Get stop details
* `PATCH /api/admin/stops/:id` — Update stop
* `DELETE /api/admin/stops/:id` — Delete stop

#### Incidents Management
* `GET /api/admin/incidents` — List all reported operational incidents
* `PATCH /api/admin/incidents/:id` — Update incident status (`reported`, `under_investigation`, `resolved`, `dismissed`) and `adminNotes`

---

### 3. Staff APIs (`/api/staff`) — Requires `STAFF` or `ADMIN` Role

#### Dashboard
* `GET /api/staff/dashboard` — Returns assignedVehicles, activeTrips, vehicleStatuses, openIncidents, and recentActivity.

#### Vehicles (Operational View)
* `GET /api/staff/vehicles` — List operational vehicles with real-time locations
* `GET /api/staff/vehicles/:id` — View vehicle status, active trip, and live coordinates

#### Trips
* `GET /api/staff/trips` — List transit trips
* `POST /api/staff/trips` — Create/schedule trip (`vehicleId`, `routeId`, `status`, `startTime`, `notes`)
* `GET /api/staff/trips/:id` — Trip details
* `PATCH /api/staff/trips/:id` — Update status (`scheduled`, `active`, `completed`, `cancelled`)

#### Incidents
* `GET /api/staff/incidents` — List incidents
* `POST /api/staff/incidents` — Report operational incident (`type`, `description`, `severity`, `latitude`, `longitude`, `vehicleId`, `routeId`)
* `GET /api/staff/incidents/:id` — Incident details

---

## ⚡ Real-Time WebSocket Events

Clients (React dashboards) connect to Socket.IO at `ws://localhost:5000` with optional JWT token authentication:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: userJwtToken }
});
```

### Events Emitted by Server:

| Event | Payload Example | Description |
|---|---|---|
| `vehicle:location_updated` | `{"vehicleId": 1, "latitude": 28.6328, "longitude": 77.2197, "speed": 34, "heading": 180, "status": "online"}` | Live GPS update received from ESP32 |
| `vehicle:status_changed` | `{"vehicleId": 1, "status": "maintenance"}` | Vehicle status modified |
| `vehicle:offline` | `{"vehicleId": 1, "status": "offline"}` | Device heartbeat expired in Redis |
| `trip:started` | `{"id": 4, "vehicleId": 1, "status": "active", ...}` | A trip has transitioned to active |
| `trip:completed` | `{"id": 4, "vehicleId": 1, "status": "completed", ...}` | A trip has concluded |
| `incident:created` | `{"id": 8, "type": "traffic", "severity": "medium", ...}` | New operational incident reported |
| `incident:updated` | `{"id": 8, "status": "resolved", ...}` | Incident status updated by Admin |

---

## 📡 MQTT Ingestion & Payload Specification

ESP32 microcontrollers with NEO-6M GPS modules publish telemetry data using MQTT:

* **Broker Port:** `1883`
* **Default Topic:** `ecotransit/vehicles/<vehicleId>/gps` (or `ecotransit/gps`)
* **Payload Format (JSON):**

```json
{
  "deviceId": "ESP32-001",
  "vehicleId": 1,
  "latitude": 28.632800,
  "longitude": 77.219700,
  "speed": 34.5,
  "heading": 180.0,
  "timestamp": "2026-09-29T12:00:00Z"
}
```

### Validation Rules:
* Latitude must be between $-90^\circ$ and $+90^\circ$.
* Longitude must be between $-180^\circ$ and $+180^\circ$.
* Exact coordinates `(0, 0)` are rejected (GPS signal search / fix failure).
* Speed must be between $0$ and $220\text{ km/h}$.
* Heading must be between $0^\circ$ and $360^\circ$.

---

## 🛡 Security & Optimization Details

1. **No Sensitive Leaks:** Password hashes, database secrets, and JWT secrets are never exposed in responses or logs.
2. **Rate Limiting:** Protects against brute-force attacks on `/api/auth/login` (30 attempts / 15 mins) and general endpoint abuse (500 requests / 15 mins).
3. **Prepared Statements:** All database interactions use parameterized SQL `$1, $2, ...` to prevent SQL injection vulnerabilities.
4. **Transient Caching:** Redis reduces database read pressure for vehicle live locations and tracks online heartbeats with auto-expiration (TTL).
5. **Database Write Throttling:** Smart distance/time delta checks guarantee high server throughput without degrading PostgreSQL disk I/O.
