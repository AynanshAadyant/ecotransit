# EcoTransit Implementation Roadmap & Tracking

Based on `IMPLEMENTATION_GUIDE.md` §12.

## Phase 0: Monorepo Scaffolding & Foundation [COMPLETE]
- [x] Monorepo directory structure & workspaces setup (`package.json`, `tsconfig.base.json`, `pyproject.toml`)
- [x] Language-neutral event schemas (`contracts/events/vehicle_position.schema.json`, `telemetry_frame.schema.json`)
- [x] OpenAPI specifications (`contracts/openapi/api-gateway.yaml`)
- [x] TypeScript Shared Packages:
  - [x] `@ecotransit/contracts` (DTOs, repositories, services, staff, telemetry, ingestion)
  - [x] `@ecotransit/core-utils` (AppError hierarchy, pino logger, zod config loader, http helpers, IST time/clock)
  - [x] `@ecotransit/auth` (RS256 JWT issuer with session revocation, strict cookies, password hashing, RBAC guards)
  - [x] `@ecotransit/data-access` (PostgreSQL pool, Redis client factory, BaseRepository with transaction & error mapping, key builders)
- [x] Python Shared Package:
  - [x] `ecotransit_shared.schemas` (Pydantic v2 data models)
  - [x] `ecotransit_shared.contracts` (ISource, IParser, IValidationRule, ISink, ICleaningRule, IModel, IFallbackPolicy)
  - [x] `ecotransit_shared.config` (BaseSettings from .env)
  - [x] `ecotransit_shared.logging` (Structured JSON logger)
  - [x] `ecotransit_shared.db` (PostgreSQL pool factory, Redis client factory, shared key builders)
  - [x] `ecotransit_shared.geo` (Haversine distance, bounding box, coordinate checks)
- [x] Database Migration Runner:
  - [x] `database/migrations/001_initial_schema.sql` (baseline schema for transit, matrix, archive, staff, incidents)
  - [x] `database/migrate.ts` (CLI runner applying migrations in forward-only transactions)
- [x] CI Pipeline & Tooling:
  - [x] `.github/workflows/ci.yml` (multi-job matrix for TypeScript & Python)
  - [x] `.prettierrc`, `eslint.config.mjs`, `.gitignore`
  - [x] Dev RS256 RSA keypair in `infra/certs/`
- [x] Python Verification Service:
  - [x] `services/python/ingestion-worker/main.py` (successfully runs & consumes `ecotransit_shared`)
- [x] TypeScript Verification Service:
  - [x] `services/javascript/api-gateway` (npm build, typecheck, verify)
- [x] Infrastructure Connectivity & Validation Tests:
  - [x] `test/database.test.ts` (PostgreSQL pool, PostGIS, migrations, ACID rollback, BaseRepository error mapping)
  - [x] `test/cache.test.ts` (Redis connection, key-value TTL, vehicle hash, geospatial indexing, route sets)
  - [x] `test/infra-connectivity.test.ts` (End-to-end joint health check, simulated fan-out ingestion write/read/cleanup)
  - [x] `test/test_infra_connectivity.py` (Python Pydantic settings, asyncpg pool, redis.asyncio client)

---

## Phase 1: Static GTFS Import & Graph Foundation [PENDING]
- [ ] Begumpur and Rithala 25m stop clustering
- [ ] Stop sequences and route segments generator
- [ ] Database seeding scripts

## Phase 2: Ingestion Worker - GTFS-RT Pipeline [COMPLETE]
- [x] Service-specific abstraction layers (`IRedisLiveStore`, `IPostgresArchiveStore`, `IOTDFeedClient`)
- [x] Delhi OTD GTFS-RT Protobuf source & pure parser (`GtfsRealtimeSource`, `GtfsProtobufParser`)
- [x] Validation chain (`ValidationChain`, `CoordinateBoundsRule`, `SpeedPlausibilityRule`, `TimestampFreshnessRule`, `DuplicatePingRule`)
- [x] Sinks (`RedisPositionSink` with 45s TTL/GEO/route sets, `PostgresArchiveSink` with batch archive, `FanOutSink`)
- [x] Ingestion Engine with dual size & timer flush (`IngestionEngine`, `ParserRegistry`, metrics)
- [x] Production composition root (`services/python/ingestion-worker/main.py`)
- [x] Appendix A tooling (`otd_collector.py`, `combine_otd_snapshots.py` 6-stage cleaning pipeline)
- [x] Comprehensive test suite (38 tests: unit, integration, custom scenarios, and failure mode graceful degradation)
- [x] Service README documentation (`services/python/ingestion-worker/README.md`, `services/javascript/api-gateway/README.md`)

## Phase 3: Ingestion Worker - MQTT & Multi-Source [PENDING]
- [ ] MQTT source & JSON parser registration without engine alteration

## Phase 4: API Gateway - Core Serving & Live Broadcast [PENDING]
- [ ] Spatial queries & stop/route search
- [ ] Socket.IO batch broadcast scheduler

## Phase 5: Commuter Web Client [PENDING]
- [ ] Map canvas with render isolation
- [ ] Ref-based marker animation interpolation

## Phase 6: Telemetry Corpus Accumulation [PENDING]
- [ ] Accumulate real telemetry corpus over Delhi transit corridors

## Phase 7: Intelligence Job - Offline Model & Matrix [PENDING]
- [ ] Trajectory extraction & cleaning pipeline
- [ ] Chronological train/validation split
- [ ] Atomic staging-swap matrix materialization

## Phase 8: API Gateway - Range-Sum ETA & Heatmaps [PENDING]
- [ ] ETA SQL range-sum query over materialized matrix
- [ ] Heatmap endpoints

## Phase 9: Staff Service - Identity & Field Operations [PENDING]
- [ ] Conductor/driver login & session issuance
- [ ] Shift binding with concurrency conflict guards
- [ ] Idempotent incident intake

## Phase 10: Admin Service & Supervision Dashboard [PENDING]
- [ ] Fleet supervision live matrix
- [ ] Incident lifecycle management & reporting

## Phase 11: Conductor Fallback Telemetry [PENDING]
- [ ] HTTPS fallback telemetry ingestion
