# EcoTransit — Ingestion Worker Service (`services/python/ingestion-worker`)

The **Ingestion Worker** is a high-throughput, resilient Python microservice responsible for ingesting live public transit vehicle positions from transport feeds, validating telemetry in real-time, and fanning out positions to both a low-latency Redis cache for live commuter tracking and a durable PostgreSQL archive for historical trajectory training.

---

## 1. Architectural Highlights

- **Universal Ingestion**: A single unified engine drives all position transports. Sources (GTFS-RT, MQTT, HTTPS fallback) plug in without changing the core engine (Open/Closed Principle).
- **Service-Specific Abstraction Layers (Ports & Adapters)**:
  - Domain components and storage sinks never interact directly with raw client drivers or raw queries.
  - Separate service-specific interfaces (`IRedisLiveStore`, `IPostgresArchiveStore`, `IOTDFeedClient`) isolate external infrastructure and coordinate with shared drivers (`ecotransit_shared.db` and `httpx`).
- **Strict Environment Secrets**:
  - All secret keys, connection strings, endpoints, and credentials are loaded exclusively from `.env` via validated Pydantic v2 Settings (`IngestionWorkerSettings`).
- **Concurrent Fan-Out with Selective Criticality**:
  - `RedisPositionSink` is **critical**: write failures abort and retry the batch to prevent stale live maps.
  - `PostgresArchiveSink` is **non-critical**: database hiccups are recorded without dropping live tracking.
- **Dual Batch Flush Mechanism**:
  - Batches flush upon reaching `INGESTION_BATCH_SIZE` (default: 100) or elapsed timer `INGESTION_FLUSH_INTERVAL_MS` (default: 2000ms), preventing telemetry stagnation during quiet periods.

---

## 2. Pipeline Stages

```
                       ┌─────────────────────────────┐
                       │     Delhi OTD Endpoint      │ (External GTFS-RT Protobuf)
                       └──────────────┬──────────────┘
                                      │ Auth header/query from ENV
                       ┌──────────────▼──────────────┐
                       │       IOTDFeedClient        │ [Feed Abstraction Layer]
                       │    (DelhiOtdFeedClient)     │ (HTTP retries, backoff)
                       └──────────────┬──────────────┘
                                      │ fetch_feed() -> raw bytes
                       ┌──────────────▼──────────────┐
                       │           ISource           │ [Ingestion Source Stage]
                       │    (GtfsRealtimeSource)     │ (reconnects internally)
                       └──────────────┬──────────────┘
                                      │ stream() yields RawPayload
                       ┌──────────────▼──────────────┐
                       │          IParser            │ [Parser Registry]
                       │    (GtfsProtobufParser)     │ (pure decode, flags suspect speed)
                       └──────────────┬──────────────┘
                                      │ parse() -> list[VehiclePosition]
                       ┌──────────────▼──────────────┐
                       │       ValidationChain       │ [Validation Stage]
                       │  ├─ CoordinateBoundsRule    │ (Delhi NCR: 28.30-28.95°N, 76.80-77.55°E)
                       │  ├─ SpeedPlausibilityRule   │ (speed <= 80 km/h)
                       │  ├─ TimestampFreshnessRule  │ (age <= 120s)
                       │  └─ DuplicatePingRule       │ ((vehicle_id, timestamp) LRU cache)
                       └──────────────┬──────────────┘
                                      │ Validated positions
                       ┌──────────────▼──────────────┐
                       │          ISink              │ [Composite FanOutSink]
                       │       (FanOutSink)          │ (asyncio.gather concurrency)
                       └──────┬──────────────┬───────┘
                              │              │
             ┌────────────────▼──┐        ┌──▼────────────────┐
             │ RedisPositionSink │        │PostgresArchiveSink│
             │    (CRITICAL)     │        │   (NON-CRITICAL)  │
             └────────┬──────────┘        └─────────┬─────────┘
                      │                             │
       ┌──────────────▼─────────────┐ ┌─────────────▼───────────────┐
       │      IRedisLiveStore       │ │    IPostgresArchiveStore    │ [Service Abstraction
       │      (RedisLiveStore)      │ │    (PostgresArchiveStore)   │  Layer]
       └──────────────┬─────────────┘ └─────────────┬───────────────┘
                      │                             │
       ┌──────────────▼─────────────┐ ┌─────────────▼───────────────┐
       │     ecotransit_shared      │ │     ecotransit_shared       │ [Shared Drivers]
       │       (Redis Client)       │ │       (asyncpg Pool)        │
       └──────────────┬─────────────┘ └─────────────┬───────────────┘
                      ▼                             ▼
                 Redis Cache               PostgreSQL Database
          live:pos:{id} (45s TTL)        vehicle_position_archive
          live:geo:vehicles (GEOADD)
          live:route:{id} (SADD)
```

---

## 3. Directory Layout

```
services/python/ingestion-worker/
├── adapters/                     # Service-specific abstraction layer (Ports & Adapters)
│   ├── feed_client.py            # IOTDFeedClient & DelhiOtdFeedClient (httpx + env auth)
│   ├── redis_store.py            # IRedisLiveStore & RedisLiveStore (hset, expire, geo, sadd)
│   └── postgres_store.py         # IPostgresArchiveStore & PostgresArchiveStore (asyncpg batch)
├── sources/
│   └── gtfs_realtime.py          # GtfsRealtimeSource (continuous async stream, silent reconnect)
├── parsers/
│   └── gtfs_protobuf.py          # GtfsProtobufParser (pure google.transit protobuf decoder)
├── validation/
│   ├── chain.py                  # ValidationChain (short-circuiting rule evaluator)
│   └── rules.py                  # CoordinateBounds, Speed, Freshness, and Duplicate rules
├── sinks/
│   ├── fan_out.py                # FanOutSink (concurrent dispatcher with criticality semantics)
│   ├── redis_sink.py             # RedisPositionSink (critical live position store)
│   └── postgres_sink.py          # PostgresArchiveSink (non-critical durable archive store)
├── tooling/                      # Appendix A Data Collection Tools
│   ├── otd_collector.py          # Appendix A.1 snapshot archiver CLI
│   └── combine_otd_snapshots.py  # Appendix A.2 6-stage cleaning & flattening CSV CLI
├── tests/                        # Comprehensive test suite
│   ├── conftest.py               # Test fixtures and mock stores
│   ├── test_adapters.py          # Unit tests for abstraction layer adapters
│   ├── test_gtfs_parser.py       # Pure parser unit tests
│   ├── test_validation_chain.py  # Rule and short-circuit tests
│   ├── test_sinks.py             # Criticality and fan-out tests
│   ├── test_engine.py            # Size and timer interval flush tests
│   ├── test_tooling.py           # Collector and combiner tests
│   ├── test_custom_scenarios.py  # Network faults, dirty data, and burst tests
│   └── test_e2e_ingestion.py     # Live Redis and PostgreSQL integration test
├── config.py                     # IngestionWorkerSettings (pydantic-settings from .env)
├── engine.py                     # IngestionEngine & ParserRegistry
├── metrics.py                    # IMetricsRecorder & InMemoryMetricsRecorder
├── main.py                       # Composition root and process lifecycle runner
└── README.md                     # This documentation
```

---

## 4. Environment Variables Reference

All settings are configured via the root `.env` file:

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `DELHI_OTD_FEED_URL` | `str` | `https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb` | Delhi OTD Protobuf feed URL |
| `DELHI_OTD_API_KEY` | `str` | `None` | Authentication secret key injected into feed requests |
| `OTD_POLL_INTERVAL_SECONDS` | `int` | `10` | Interval between polling requests |
| `HTTP_TIMEOUT_SECONDS` | `float` | `10.0` | HTTP request timeout for feed fetches |
| `INGESTION_MAX_RETRIES` | `int` | `3` | Max retries before backing off on feed errors |
| `INGESTION_BACKOFF_FACTOR` | `float` | `1.5` | Exponential backoff multiplier for transport retries |
| `POSTGRES_HOST` | `str` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `int` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `str` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `str` | `""` | PostgreSQL password |
| `DATABASE_NAME` | `str` | `ecotransit` | PostgreSQL database name |
| `REDIS_HOST` | `str` | `localhost` | Redis server host |
| `REDIS_PORT` | `int` | `6379` | Redis server port |
| `REDIS_PASSWORD` | `str` | `None` | Redis server password |
| `REDIS_TTL_SECONDS` | `int` | `45` | TTL for live vehicle telemetry keys in Redis |
| `INGESTION_BATCH_SIZE` | `int` | `100` | Position count threshold triggering immediate batch flush |
| `INGESTION_FLUSH_INTERVAL_MS`| `int` | `2000` | Max milliseconds before flushing buffered positions |
| `INGESTION_MAX_AGE_SECONDS` | `int` | `120` | Max telemetry age before position is marked stale |
| `INGESTION_MAX_SPEED_KMH` | `float` | `80.0` | Maximum plausible speed before position is rejected |

---

## 5. Running the Service

### Run the Ingestion Worker Daemon
```bash
python services/python/ingestion-worker/main.py
```

### Run Appendix A OTD Snapshot Collector
Polls Delhi OTD and saves raw JSON snapshots to disk for long-term historical accumulation:
```bash
python services/python/ingestion-worker/tooling/otd_collector.py --output-dir otd_data --interval 10 --max-polls 50
```

### Run Appendix A Snapshot Combiner & Cleaner
Applies the 6-stage cleaning pipeline across collected JSON snapshots and outputs a training-ready CSV:
```bash
python services/python/ingestion-worker/tooling/combine_otd_snapshots.py --input-dir otd_data --output otd_combined.csv
```

---

## 6. Running Tests

Execute the full suite of ingestion worker unit, scenario, and live integration tests:
```bash
pytest services/python/ingestion-worker/tests
```

Run code quality linting:
```bash
ruff check services/python/ingestion-worker
```
