# EcoTransit — API Gateway Service (`services/javascript/api-gateway`)

The **API Gateway** is a high-performance, resilient TypeScript / Node.js microservice responsible for providing commuter-facing REST endpoints and real-time Socket.IO telemetry broadcast channels for live bus tracking, spatial stop resolution, origin-to-destination journey planning, and range-sum ETA querying over precomputed traversal matrices.

---

## 1. Architectural Highlights

- **Pure Translation Layer**: Controllers translate HTTP into domain calls and domain results into HTTP envelopes (`ok`, `created`, `noContent`). Business logic resides strictly in services. No Express imports exist in services or repositories.
- **Strict Inward Layering**: Dependencies point strictly inward:
  `Routes -> Controllers -> Services -> Repositories -> Data Access Drivers`.
- **Zero Inference Overhead**: Serves ETA queries directly via range-sum lookups over the precomputed `route_segment_traversal_matrix` in PostgreSQL with 3-tier fallback (ML prediction -> Naive average -> Default route speed). No machine learning model inference is executed on any request path.
- **Real-Time Broadcast Engine with Delta Compression**: `BroadcastScheduler` runs on an isolated interval timer, fetching live positions from Redis and emitting compressed `'delta'` frames carrying only moved/changed vehicles alongside periodic `'full'` sync frames (every 60s) to minimize client payload.
- **Direction-Aware Spatial Resolution (Open Decision §13)**: Heading vector dot-product math ($\vec{u} \cdot \vec{v}$) in `PostgresStopRepository` resolves whether candidate stops are ahead or behind a moving bus, preventing segment inversion and erroneous ETAs.
- **Origin-to-Destination Journey Resolver**: Direct route discovery with stop sequence progression (`origin_sequence < destination_sequence`) and multi-stop coordinate search.
- **Edge Schema Validation**: Zod schemas validate every path parameter, query string, and request payload before hitting domain services.
- **Resilient Degradation**: Isolated error handling prevents database hiccups or Redis timeouts from crashing the broadcast timer loop or HTTP server process.

---

## 2. Telemetry & Serving Architecture

```
                       ┌─────────────────────────────┐
                       │     Commuter Web / App      │ (REST & Socket.IO Clients)
                       └──────────────┬──────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
     HTTP REST Requests                                WebSocket Connection
            │                                                   │
    ┌───────▼───────┐                                   ┌───────▼───────┐
    │ Express Routes│ (/api/*)                          │ Socket Gateway│ (Rooms & Events)
    └───────┬───────┘                                   └───────▲───────┘
            │                                                   │
    ┌───────▼───────┐                                   ┌───────┴───────┐
    │  Controllers  │ [BaseController Envelope]         │  Broadcast    │ [Delta Engine]
    └───────┬───────┘                                   │   Scheduler   │ (5s Timer)
            │                                           └───────▲───────┘
    ┌───────▼───────┐                                           │
    │Domain Services│ (Stop, Route, Vehicle, Eta)                 │
    └───────┬───────┘                                           │
            │                                                   │
    ┌───────▼───────────────────────────────────────────────────┴───┐
    │                        Repositories                           │
    │  ├─ PostgresStopRepo (Spatial & Heading Vector Math)          │
    │  ├─ PostgresRouteRepo (Direct Journey Resolution)             │
    │  ├─ PostgresSegmentRepo (Downstream Segment Sequences)        │
    │  ├─ PostgresMatrixRepo (3-Tier Fallback Range-Sum Query)      │
    │  └─ RedisLivePositionRepo (Hot Cache & GEO Indexing)          │
    └────────────────┬─────────────────────────────────┬────────────┘
                     │                                 │
                     ▼                                 ▼
            PostgreSQL / PostGIS                  Redis Hot Cache
         (Stops, Routes, Matrix)                (live:pos, live:geo)
```

---

## 3. Directory Layout

```
services/javascript/api-gateway/
├── src/
│   ├── config.ts                     # Zod environment config loader at boot
│   ├── container.ts                  # Composition root (IoC) wiring application dependencies
│   ├── app.ts                        # Express application factory (CORS, JSON, routes, errorMiddleware)
│   ├── index.ts                      # HTTP & Socket.IO server bootstrap & graceful shutdown
│   ├── dto/                          # Edge request/response Zod validation schemas
│   │   ├── stops.dto.ts              # Nearby and search query schemas
│   │   ├── routes.dto.ts             # Route parameter schemas
│   │   ├── vehicles.dto.ts           # Vehicle parameter schemas
│   │   ├── journey.dto.ts            # Origin-destination journey search schemas
│   │   ├── eta.dto.ts                # Vehicle ETA query schemas
│   │   └── index.ts                  # Re-export index
│   ├── repositories/                 # Storage access extending BaseRepository
│   │   ├── contracts.ts              # Re-exported repository interfaces
│   │   ├── redis-live-position.repository.ts # Redis live position store
│   │   ├── postgres-stop.repository.ts  # Spatial & direction-aware stop repository
│   │   ├── postgres-route.repository.ts # Route catalog & direct journey repository
│   │   ├── postgres-route-segment.repository.ts # Route segment sequence repository
│   │   ├── postgres-traversal-matrix.repository.ts # Traversal matrix range-sum repository
│   │   └── index.ts                  # Re-export index
│   ├── services/                     # Pure domain services (no Express types)
│   │   ├── contracts.ts              # IEtaService interface
│   │   ├── stop.service.ts           # Stop resolution & spatial search logic
│   │   ├── route.service.ts          # Route graph & origin-destination resolver
│   │   ├── vehicle.service.ts        # Live position querying logic
│   │   ├── eta.service.ts            # Traversal matrix range-sum ETA logic
│   │   └── index.ts                  # Re-export index
│   ├── realtime/                     # Real-time Socket.IO gateway & broadcast scheduler
│   │   ├── socket.gateway.ts         # Socket.IO event handler & room subscription manager
│   │   ├── broadcast.scheduler.ts    # Broadcast scheduler & delta compression engine
│   │   └── index.ts                  # Re-export index
│   ├── controllers/                  # HTTP translation controllers extending BaseController
│   │   ├── health.controller.ts      # Health check controller
│   │   ├── stop.controller.ts        # Stop spatial query HTTP handler
│   │   ├── route.controller.ts       # Route & journey HTTP handler
│   │   ├── vehicle.controller.ts     # Vehicle fleet HTTP handler
│   │   ├── eta.controller.ts         # ETA query HTTP handler
│   │   └── index.ts                  # Re-export index
│   └── routes/                       # Express router declarations
│       ├── health.routes.ts          # /api/health
│       ├── stop.routes.ts            # /api/stops/*
│       ├── route.routes.ts           # /api/routes/*
│       ├── vehicle.routes.ts         # /api/vehicles/*
│       ├── eta.routes.ts             # /api/eta/*
│       └── index.ts                  # Main API router aggregator
├── tests/                            # Comprehensive test suite
│   ├── fixtures/
│   │   └── mock-repositories.ts      # In-memory mock stores for fast unit & scenario tests
│   ├── unit/
│   │   ├── test_services.test.ts     # Domain service unit tests
│   │   ├── test_broadcast_scheduler.test.ts # Scheduler & delta engine tests
│   │   └── test_dto_validation.test.ts # Zod schema edge boundary tests
│   ├── scenarios/
│   │   ├── test_failure_modes.test.ts # Database drops, Redis outages, invalid routes
│   │   └── test_custom_scenarios.test.ts # Direction math & coordinate journey tests
│   └── integration/
│       └── test_e2e_api_gateway.test.ts # Joint HTTP REST & Socket.IO E2E integration test
├── package.json                      # Service workspace configuration
├── tsconfig.json                     # Service TypeScript configuration
└── README.md                         # Service documentation
```

---

## 4. Environment Variables Reference

All settings are configured via environment variables and validated at boot time (`src/config.ts`):

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `PORT_API_GATEWAY` | `number` | `4000` | HTTP and WebSocket server port |
| `CORS_ORIGIN` | `string` | `*` | Allowed CORS origins for REST and Socket.IO |
| `BROADCAST_INTERVAL_MS` | `number` | `5000` | Telemetry broadcast interval in milliseconds |
| `DEFAULT_ROUTE_SPEED_MS` | `number` | `8.33` | Fallback default route speed (~30 km/h) in m/s |
| `MIN_SAMPLE_COUNT_ML_THRESHOLD` | `number` | `30` | Min matrix sample count required to use ML predictions over naive averages |
| `POSTGRES_HOST` | `string` | `localhost` | PostgreSQL server host |
| `POSTGRES_PORT` | `number` | `5432` | PostgreSQL server port |
| `POSTGRES_USER` | `string` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `string` | `""` | PostgreSQL password |
| `DATABASE_NAME` | `string` | `ecotransit` | PostgreSQL database name |
| `REDIS_HOST` | `string` | `localhost` | Redis server host |
| `REDIS_PORT` | `number` | `6379` | Redis server port |
| `REDIS_PASSWORD` | `string` | `None` | Redis server password |
| `DELHI_BBOX_MIN_LAT` | `number` | `28.30` | Minimum bounding latitude for Delhi NCR |
| `DELHI_BBOX_MAX_LAT` | `number` | `28.95` | Maximum bounding latitude for Delhi NCR |
| `DELHI_BBOX_MIN_LON` | `number` | `76.80` | Minimum bounding longitude for Delhi NCR |
| `DELHI_BBOX_MAX_LON` | `number` | `77.55` | Maximum bounding longitude for Delhi NCR |

---

## 5. API Endpoints & Real-Time Specification

### 5.1 HTTP REST Endpoints

| Method | Endpoint | Description | Query / Path Parameters |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Health check & system status | None |
| `GET` | `/api/stops/nearby` | Find stops within search radius | `lat` (float), `lon` (float), `radius` (meters, default: 1000) |
| `GET` | `/api/stops/search` | Case-insensitive stop name search | `q` (string), `limit` (int, default: 20) |
| `GET` | `/api/stops/:stopId` | Get single stop details | `stopId` (path string) |
| `GET` | `/api/stops/:stopId/routes` | Get routes serving a specific stop | `stopId` (path string) |
| `GET` | `/api/routes` | List all registered routes | None |
| `GET` | `/api/routes/search` | Search direct journeys by stop IDs | `originStopId` (string), `destinationStopId` (string) |
| `GET` | `/api/routes/search-coords` | Search journeys by lat/lon coordinates | `fromLat`, `fromLon`, `toLat`, `toLon`, `radiusM` |
| `GET` | `/api/routes/:routeId` | Get single route details | `routeId` (path string) |
| `GET` | `/api/routes/:routeId/stops` | Get ordered list of stops on a route | `routeId` (path string) |
| `GET` | `/api/routes/:routeId/vehicles` | Get live vehicles active on a route | `routeId` (path string) |
| `GET` | `/api/vehicles/live` | List all active live vehicles | None |
| `GET` | `/api/vehicles/live/:vehicleId` | Get single live vehicle position | `vehicleId` (path string) |
| `GET` | `/api/eta/:vehicleId` | Calculate range-sum ETA for vehicle | `vehicleId` (path), `stopId` (query string) |

### 5.2 Socket.IO Telemetry Channels

- **Connection Endpoint**: `ws://<host>:<port>`
- **Emitted Server Events**:
  - `telemetry_frame`: Emitted every 5 seconds to all connected clients. Payload structure (`TelemetryBatchFrame`):
    ```json
    {
      "timestamp": 1759228800,
      "frameType": "full | delta",
      "vehicles": [
        {
          "vehicleId": "DL1PC8888",
          "routeId": "419",
          "latitude": 28.6315,
          "longitude": 77.2167,
          "speed": 12.5,
          "bearing": 90.0,
          "timestamp": 1759228800
        }
      ]
    }
    ```
  - `vehicle_update`: Emitted to specific route rooms (`route:{routeId}`).
- **Client Listened Events**:
  - `subscribe_route`: Subscribes client socket to a specific route room (`routeId: string`).
  - `unsubscribe_route`: Unsubscribes client socket from a route room.

---

## 6. Running the Service & Testing

### 6.1 Running in Development Mode
```bash
npm run start --workspace=services/javascript/api-gateway
```

### 6.2 Running Monorepo Typecheck & Build
```bash
npm run typecheck
npm run build
```

### 6.3 Executing the Test Suite

Run the comprehensive unit, scenario, failure mode, and E2E integration test suite (35 tests):
```bash
npm run test --workspace=services/javascript/api-gateway
```

Run infrastructure connectivity and PostGIS / Redis tests:
```bash
npm run test:infra
```
