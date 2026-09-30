# EcoTransit — Implementation Specification

*Source of truth for full-system development beyond the MVP*

| Field | Detail |
| --- | --- |
| **Project** | Eco-Transit — Cost-Effective, Resilient Public Transit Tracking and Predictive Journey-Planning Architecture for Infrastructure-Limited Cities |
| **Authors** | Aynansh Aadyant, Krishna Kumar, Sumit Kumar, Dr. Nisha Aggarwal |
| **Institution** | Maharaja Agrasen Institute of Technology, New Delhi — B.Tech CSE, Batch 2023–2027 |
| **Consolidates** | EcoTransit V1 System Design Document; EcoTransit Implementation Architecture v1.1; conference paper draft 2 |
| **Status** | Authoritative. Supersedes both prior design documents for implementation purposes. |
| **Data policy** | Real-world data only. No simulators, mock engines, or synthetic feeds in any service. |

---

## 1. Scope and Governing Principles

This document specifies **how** EcoTransit is built. Where the two prior design documents described what the system is, this one describes the modules, classes, interfaces, and directory boundaries that developers work against. It is the reference that resolves disagreements.

### 1.1 Governing Principles

- **Real data only** — Every service consumes live or recorded real-world data. No simulator, fake feed, seeded random generator, or mock engine is written at any layer. Where a data source is unavailable in development, the service reads from a recorded archive of real telemetry rather than a generated substitute.
- **Universal ingestion** — One ingestion pipeline serves all position sources. MQTT is the primary transport; GTFS-RT polling is a second source feeding the same pipeline. Neither is special-cased in the engine.
- **Controller flow is not business logic** — Controllers translate HTTP into a call and a call's result into HTTP. All decision-making lives in service classes under a separate directory. A controller containing a conditional about transit behaviour is a defect.
- **Dependencies point inward** — Controllers depend on services; services depend on repository interfaces; repositories depend on drivers. Nothing depends outward. A service never imports Express, and a repository never imports a controller.
- **Shared code is a package, not a copy** — Cross-cutting concerns (JWT, cookies, errors, logging, config, geospatial math) live in versioned shared packages consumed by workspace reference. Duplicating a helper across services is a defect.

### 1.2 SOLID as Applied Here

| Principle | Concrete Obligation in This Codebase |
| --- | --- |
| **Single Responsibility** | A parser parses and does not validate. A sink writes and does not decide what to write. A controller has one reason to change: the HTTP contract. |
| **Open/Closed** | Adding a BLE position source, a new sink, or a new validation rule requires a new class and one line of wiring — never an edit to `IngestionEngine`. |
| **Liskov Substitution** | Any `ISink` can replace any other without the engine behaving differently. A sink that throws on partial failure where others return a result violates this. |
| **Interface Segregation** | `ISource`, `IParser`, `IValidationRule`, and `ISink` are four narrow contracts rather than one `IIngestionComponent`. A Redis sink is not forced to implement parsing methods. |
| **Dependency Inversion** | `EtaService` depends on `ITraversalMatrixRepository`, not on the `pg` client. Swapping Postgres for a read replica or an in-memory store for tests changes no service code. |

### 1.3 Language Decision: TypeScript for JavaScript Services

The requirement for interfaces and base classes enforcing SOLID cannot be met in plain JavaScript, which has no interface construct. Three options exist, and this specification chooses the first:

1. **TypeScript across all JavaScript services and shared packages.** Interfaces are compile-time enforced, contracts are self-documenting, and refactors across a monorepo are safe. Cost: a build step and a migration of existing MVP files.
2. **Plain JavaScript with abstract base classes** that throw on unimplemented methods, plus JSDoc typedefs. Contracts become runtime-only and partially advisory.
3. **Plain JavaScript with no enforcement** — rejected, as it makes the SOLID requirement unverifiable.

> **Decision:** TypeScript is adopted for all JavaScript services. Interface names are prefixed with `I` to keep the contract layer visually distinct from implementations, matching the Python side.
> 
> If the team prefers to avoid the migration cost, option 2 is a workable fallback and every interface in this document maps to an abstract base class with the same member names — but the shared contracts package should still be TypeScript, since it is new code with no migration cost.

---

## 2. Monorepo Layout

Services are separated first by language, then by service. Shared code is likewise split by language, because a Python package and an npm package cannot be shared across the boundary. Cross-language agreement is maintained through the `contracts/` directory, which holds language-neutral schema definitions that both sides generate from.

```
ecotransit/
├── package.json                  # npm workspaces root
├── tsconfig.base.json
├── pyproject.toml                # python workspace root
│
├── contracts/                    # language-neutral source of truth
│   ├── events/                   # JSON Schema for MQTT payloads, socket frames
│   ├── openapi/                  # REST contracts per service
│   └── README.md
│
├── services/
│   ├── javascript/
│   │   ├── api-gateway/          # commuter-facing REST + Socket.IO
│   │   ├── staff-service/        # identity, shift binding, incident intake
│   │   ├── admin-service/        # fleet supervision, incident management
│   │   ├── web-commuter/         # React commuter client
│   │   ├── web-staff/            # React staff portal
│   │   └── web-admin/            # React admin dashboard
│   └── python/
│       ├── ingestion-worker/     # universal ingestion pipeline
│       └── intelligence-job/     # offline training + matrix materialisation
│
├── shared/
│   ├── javascript/
│   │   ├── contracts/            # @ecotransit/contracts  (interfaces, DTOs)
│   │   ├── core-utils/           # @ecotransit/core-utils (errors, logger, config, time)
│   │   ├── auth/                 # @ecotransit/auth       (jwt, cookies, guards)
│   │   └── data-access/          # @ecotransit/data-access(pg pool, redis, base repo)
│   └── python/
│       └── ecotransit_shared/    # schemas, config, logging, db, geo
│
├── database/
│   ├── migrations/               # ordered, forward-only SQL
│   └── seeds/                    # real GTFS static import scripts only
│
└── infra/
    ├── docker/
    └── compose/
```

### 2.1 Why This Split

- **Language-first, not service-first** — Toolchains do not mix. A Python service and a Node service need different lockfiles, linters, test runners, and CI steps. Grouping by language means one toolchain configuration per group instead of one per service.
- **`contracts/` sits above both** — The MQTT payload shape and the Socket.IO frame shape are agreed between a Python producer and a TypeScript consumer. Keeping that definition in a neutral directory prevents the shape from being defined twice and drifting.
- **Clients are services** — The three React applications live under `services/javascript` rather than a separate `apps/` tree, because they consume the same shared contracts package and benefit from the same workspace tooling.

---

## 3. Service Inventory

| Service | Language | Responsibility | Depends On |
| --- | --- | --- | --- |
| **Ingestion Worker** | Python | Acquire vehicle positions from all sources, parse, validate, fan out to hot cache and durable store | MQTT broker, GTFS-RT endpoint, Redis, PostgreSQL |
| **API Gateway** | TypeScript | Commuter REST serving, spatial queries, ETA composition, live telemetry broadcast | Redis, PostgreSQL/PostGIS |
| **Intelligence Job** | Python | Traversal sample extraction, model training, traversal matrix materialisation | PostgreSQL (read archive, write matrix) |
| **Staff Service** | TypeScript | Staff identity, session issuance, shift binding, incident intake | PostgreSQL, Redis |
| **Admin Service** | TypeScript | Fleet supervision views, incident lifecycle management, staff administration | PostgreSQL, Redis, Staff Service (token verification) |
| **Commuter Web** | TypeScript / React | Live map, search, journey planning, ETA and heatmap display | API Gateway |
| **Staff Portal** | TypeScript / React | Shift confirmation, incident reporting, fallback position publishing | Staff Service |
| **Admin Dashboard** | TypeScript / React | Fleet matrix, incident queue, staff management | Admin Service |

> **Boundary decision — Staff and Admin are separate services sharing one identity store.**
> 
> Both are staff-authenticated, which invites merging them. They are kept separate because their traffic shapes and blast radii differ: the Staff Service takes writes from vehicles in the field on unreliable connections, while the Admin Service serves a small number of long-lived internal dashboard sessions. A slow admin aggregation query should not compete for the connection pool that conductors need to file a breakdown report.
> 
> They share one credential store and one token format. The Staff Service is the sole token issuer; the Admin Service verifies tokens using the shared auth package and never authenticates directly. This avoids two password databases, which is the failure mode worth preventing.

---

## 4. Shared Packages

### 4.1 `@ecotransit/core-utils`

| Module | Exports | Purpose |
| --- | --- | --- |
| `errors/` | `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `UpstreamError` | One error hierarchy across services so a single handler can map any thrown error to a status code |
| `logger/` | `createLogger(serviceName)` | Structured JSON logging with correlation id; never `console.log` in service code |
| `config/` | `loadConfig(schema)` | Environment parsing validated against a schema at boot; the process refuses to start on a missing variable rather than failing at first request |
| `http/` | `asyncHandler`, `ok`, `created`, `noContent`, `errorMiddleware` | Response envelope and async error propagation |
| `time/` | `IClock`, `SystemClock`, `hourOfDay`, `dayType` | Clock injected rather than called statically, so time-dependent ETA logic is testable |

The `time` module deserves a note: `hourOfDay` and `dayType` are the two discrete dimensions of the traversal matrix, and they must be computed identically by the Python job that writes the matrix and the TypeScript service that reads it. Defining them once per language against the same specification — including the timezone, which is `Asia/Kolkata` and not the server's locale — prevents an off-by-one-hour class of bug that would be nearly invisible in testing.

### 4.2 `@ecotransit/auth`

```typescript
// shared/javascript/auth/src/contracts.ts

export interface ITokenIssuer {
  issue(claims: StaffClaims, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<StaffClaims>;
}

export interface IPasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export interface ISessionStore {
  put(sessionId: string, session: StaffSession, ttlSeconds: number): Promise<void>;
  get(sessionId: string): Promise<StaffSession | null>;
  revoke(sessionId: string): Promise<void>;
}

export interface StaffClaims {
  staffId: string;
  role: StaffRole;              // 'conductor' | 'driver' | 'dispatcher' | 'admin'
  sessionId: string;
}
```

| Module | Exports | Notes |
| --- | --- | --- |
| `jwt/` | `JwtTokenIssuer implements ITokenIssuer` | RS256 with a key pair, so the Admin Service verifies with a public key and never holds signing material |
| `cookies/` | `setAuthCookie`, `clearAuthCookie`, `readAuthCookie` | `httpOnly`, `secure`, `sameSite=strict`, explicit `maxAge`. Centralised so no service can accidentally issue a non-httpOnly auth cookie |
| `hashing/` | `Argon2PasswordHasher implements IPasswordHasher` | Argon2id. The interface exists so the algorithm can be replaced without touching `AuthService` |
| `guards/` | `requireAuth()`, `requireRole(...roles)` | Express middleware producing `UnauthorizedError` / `ForbiddenError` from the shared hierarchy |

> **Why the token issuer is an interface rather than a function** — Signing appears to be a pure utility, which argues for a plain exported function. It is modelled as an interface because verification needs to consult the session store for revocation — a logged-out conductor's unexpired token must stop working. That makes the issuer stateful, and a stateful dependency should be injected so that `AuthService` can be tested without Redis and so revocation strategy can change without touching callers.

### 4.3 `@ecotransit/data-access`

```typescript
// shared/javascript/data-access/src/base-repository.ts

export abstract class BaseRepository {
  protected constructor(protected readonly pool: Pool) {}

  protected async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const started = performance.now();
    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (cause) {
      throw this.mapDriverError(cause);   // pg error codes -> AppError subclasses
    } finally {
      this.recordLatency(performance.now() - started);
    }
  }

  protected async withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (cause) {
      await client.query('ROLLBACK');
      throw this.mapDriverError(cause);
    } finally {
      client.release();
    }
  }
}
```

Every repository extends this. The consequence worth stating: no service class ever sees a driver-level error. A unique-constraint violation arrives at the service layer as a `ConflictError`, which the service can reason about without importing anything from `pg`.

### 4.4 `ecotransit_shared` (Python)

| Module | Contents |
| --- | --- |
| `schemas/` | Pydantic models: `RawPayload`, `VehiclePosition`, `TraversalSample`, `MatrixCell`. These are the validated shapes crossing module boundaries. |
| `config/` | Settings classes loaded from environment with validation at import time |
| `logging/` | Structured logger factory matching the JSON shape used by the TypeScript services, so both stream into one log pipeline |
| `db/` | Async PostgreSQL pool factory, Redis client factory, key builders shared with the TypeScript side |
| `geo/` | Haversine distance, bounding-box containment, coordinate sanity checks |
| `contracts/` | Abstract base classes: `ISource`, `IParser`, `IValidationRule`, `ISink`, `IModel`, `IFallbackPolicy` |

---

## 5. Service: Ingestion Worker (Python)

A single universal pipeline. Position data from any transport enters through a source adapter, is parsed into a canonical record, validated, and fanned out to a hot cache and a durable store. The engine that drives this knows nothing about MQTT, Protobuf, Redis, or Postgres.

### 5.1 Pipeline Stages

```
  MQTT Broker  ──┐
                 ├──►  ISource  ──►  IParser  ──►  Validator  ──►  FanOutSink  ──┬──► RedisPositionSink
  GTFS-RT Feed ──┘      (adapter)    (registry)    (rule chain)    (composite)    └──► PostgresArchiveSink
  HTTPS fallback ┘
```

| Stage | Contract | Implementations |
| --- | --- | --- |
| Source | `ISource` | `MqttSource` (primary), `GtfsRealtimeSource` (poller), `HttpFallbackSource` (conductor smartphone) |
| Parser | `IParser` | `JsonPositionParser` (MQTT/edge JSON), `GtfsProtobufParser` |
| Validation | `IValidationRule` | `CoordinateBoundsRule`, `SpeedPlausibilityRule`, `TimestampFreshnessRule`, `DuplicatePingRule` |
| Sink | `ISink` | `RedisPositionSink` (critical), `PostgresArchiveSink` (non-critical) |

### 5.2 Interfaces

```python
# shared/python/ecotransit_shared/contracts/ingestion.py

class ISource(ABC):
    """A transport that yields raw, unparsed position payloads."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def open(self) -> None: ...

    @abstractmethod
    def stream(self) -> AsyncIterator[RawPayload]:
        """Yields payloads until close() is called. Must not raise on
        transient transport errors; reconnect internally and keep yielding."""

    @abstractmethod
    async def close(self) -> None: ...


class IParser(ABC):
    @abstractmethod
    def supports(self, payload: RawPayload) -> bool: ...

    @abstractmethod
    def parse(self, payload: RawPayload) -> list[VehiclePosition]:
        """Pure. Raises ParseError on malformed input; never performs I/O."""


class IValidationRule(ABC):
    @property
    @abstractmethod
    def code(self) -> str: ...

    @abstractmethod
    def check(self, position: VehiclePosition,
              context: ValidationContext) -> RuleOutcome: ...


class ISink(ABC):
    @property
    @abstractmethod
    def is_critical(self) -> bool:
        """If True, a write failure aborts the batch and is retried.
        If False, failure is logged and the batch proceeds."""

    @abstractmethod
    async def write(self, batch: list[VehiclePosition]) -> SinkResult: ...

    @abstractmethod
    async def health(self) -> HealthStatus: ...
```

### 5.3 Composites

```python
# services/python/ingestion-worker/pipeline/validation.py

class ValidationChain:
    """Runs rules in order, short-circuiting on the first rejection.
    Adding a rule requires no change to this class."""

    def __init__(self, rules: Sequence[IValidationRule]) -> None:
        self._rules = tuple(rules)

    def evaluate(self, position: VehiclePosition,
                 context: ValidationContext) -> ValidationResult: ...


# services/python/ingestion-worker/pipeline/sinks/fan_out.py

class FanOutSink(ISink):
    """Composite sink. Writes to all children concurrently.
    Critical child failure propagates; non-critical failure is recorded."""

    def __init__(self, children: Sequence[ISink]) -> None:
        self._children = tuple(children)

    @property
    def is_critical(self) -> bool:
        return any(child.is_critical for child in self._children)

    async def write(self, batch: list[VehiclePosition]) -> SinkResult: ...
```

> **Why `is_critical` sits on the sink and not in the engine** — The engine must decide whether to retry a batch when one sink fails. Putting that decision in the engine means a conditional naming specific sinks — exactly the coupling the Open/Closed principle forbids. Declaring criticality on the sink itself lets the engine ask rather than know.
> 
> The practical effect: if the archive write fails, live tracking continues uninterrupted; if the Redis write fails, the batch is retried, because a commuter seeing a stale map is a worse outcome than a gap in training data.

### 5.4 Engine and Composition Root

```python
# services/python/ingestion-worker/engine.py

class IngestionEngine:
    def __init__(
        self,
        source: ISource,
        parsers: ParserRegistry,
        validation: ValidationChain,
        sink: ISink,
        metrics: IMetricsRecorder,
        batch_size: int,
        flush_interval_ms: int,
    ) -> None: ...

    async def run(self) -> None:
        """Consume source.stream(), parse, validate, accumulate into
        batches, flush on size or interval, whichever comes first."""


# services/python/ingestion-worker/main.py  -- the only place that names
# concrete classes. Everything else depends on contracts.

def build_engine(settings: Settings) -> IngestionEngine:
    source = MqttSource(settings.mqtt) if settings.source == "mqtt" \
             else GtfsRealtimeSource(settings.gtfs)
    return IngestionEngine(
        source=source,
        parsers=ParserRegistry([JsonPositionParser(), GtfsProtobufParser()]),
        validation=ValidationChain([
            CoordinateBoundsRule(settings.service_area),
            SpeedPlausibilityRule(max_kmh=80),
            TimestampFreshnessRule(max_age_s=120),
            DuplicatePingRule(),
        ]),
        sink=FanOutSink([
            RedisPositionSink(redis_client, ttl_seconds=45),
            PostgresArchiveSink(pg_pool),
        ]),
        metrics=PrometheusMetrics(),
        batch_size=settings.batch_size,
        flush_interval_ms=settings.flush_interval_ms,
    )
```

### 5.5 Architectural Choices

| Choice | Rationale |
| --- | --- |
| Batch accumulation with size-or-interval flush | Per-ping writes to Redis and Postgres would issue thousands of round trips per minute at fleet scale. Batching amortises round-trip cost; the interval bound ensures a quiet period still flushes promptly rather than holding positions until a batch fills. |
| Concurrent fan-out, not sequential | The archive write is slower than the Redis write. Running them sequentially would make live position freshness hostage to durable-store latency. |
| Parser selection by registry, not by conditional | `supports()` lets a payload find its parser. Adding BLE beacon payloads later means registering one more parser rather than extending a branch. |
| Source reconnects internally | The engine's loop should not contain transport error handling. A source that reconnects silently keeps that concern where the transport knowledge already is. |
| Validation short-circuits | Rules are ordered cheapest-first (bounds check before duplicate lookup), so the common rejection path costs the least. |

---

## 6. Service: API Gateway (TypeScript)

Serves the commuter client. Owns no long-running computation and no model inference — it reads Redis and PostgreSQL and composes responses.

### 6.1 Layering

```
services/javascript/api-gateway/src/
├── routes/            # URL -> controller method binding only
├── controllers/       # HTTP in, HTTP out. No business rules.
├── services/          # business logic. No Express imports.
├── repositories/      # SQL and Redis access. Extends BaseRepository.
├── realtime/          # Socket.IO gateway + broadcast scheduler
├── dto/               # request/response schemas, validated at the edge
└── container.ts       # composition root: the only file naming concrete classes
```

| Layer | May Import | May Never Import |
| --- | --- | --- |
| `routes` | controllers | services, repositories |
| `controllers` | services, dto | repositories, pg, redis |
| `services` | repository interfaces, dto, shared utils | express, req/res types |
| `repositories` | data-access, driver clients | services, controllers |

*This table is enforceable with a lint rule on import paths, and should be, because layering discipline erodes silently otherwise — usually the first time someone needs one extra field and reaches straight from a controller into a repository.*

### 6.2 Controller and Service Separation

```typescript
// controllers/eta.controller.ts

export class EtaController extends BaseController {
  constructor(private readonly etaService: IEtaService) { super(); }

  getEtaForVehicle = this.handle(async (req) => {
    const query = GetVehicleEtaSchema.parse({
      vehicleId: req.params.vehicleId,
      targetStopId: req.query.stopId,
    });
    return this.etaService.getEtaForVehicle(query);
  });
}

// services/eta.service.ts  -- no Express, no SQL, no HTTP status codes

export class EtaService implements IEtaService {
  constructor(
    private readonly positions: ILivePositionRepository,
    private readonly segments: IRouteSegmentRepository,
    private readonly matrix: ITraversalMatrixRepository,
    private readonly clock: IClock,
  ) {}

  async getEtaForVehicle(q: GetVehicleEtaQuery): Promise<EtaResult> {
    const position = await this.positions.find(q.vehicleId);
    if (!position) throw new NotFoundError('vehicle_not_live', q.vehicleId);

    const remaining = await this.segments.findRemaining(
      position.routeId, position.nearestStopSequence, q.targetStopId,
    );
    if (remaining.length === 0) throw new ValidationError('stop_not_downstream');

    const bucket = this.clock.bucket();          // { hourOfDay, dayType }
    return this.matrix.sumTraversal(remaining.map(s => s.segmentId), bucket);
  }
}
```

> **What the split buys, concretely** — The ETA rule set — vehicle must be live, target stop must be downstream, traversal is a bucketed sum — is stated once, in one class, with no HTTP vocabulary. The same service backs a REST endpoint today and a Socket.IO request or a scheduled precomputation later without modification.
> 
> It also makes the controller trivially reviewable: if a controller is longer than about fifteen lines, logic has leaked into it.

### 6.3 Repository Interfaces

```typescript
// repositories/contracts.ts

export interface ILivePositionRepository {
  find(vehicleId: string): Promise<LivePosition | null>;
  findAllLive(): Promise<LivePosition[]>;
  findByRoute(routeIds: string[]): Promise<LivePosition[]>;
}

export interface ITraversalMatrixRepository {
  sumTraversal(segmentIds: number[], bucket: TimeBucket): Promise<EtaResult>;
  fetchHeatmapForRoute(routeId: string, bucket: TimeBucket): Promise<SegmentHeat[]>;
}

export interface IRouteSegmentRepository {
  findRemaining(routeId: string, fromSequence: number,
                targetStopId: string): Promise<RouteSegment[]>;
  findRemainingForMany(requests: RemainingSegmentsRequest[]
                      ): Promise<Map<string, RouteSegment[]>>;
}

export interface IStopRepository {
  findNearby(lat: number, lon: number, radiusM: number): Promise<Stop[]>;
  findNearestOnRoute(routeId: string, lat: number,
                     lon: number): Promise<NearestStopResult>;
  findRoutesServingStop(stopId: string): Promise<RouteSummary[]>;
}
```

`findRemainingForMany` exists deliberately alongside `findRemaining`. The broadcast path and the route-search path both need remaining segments for many vehicles at once, and issuing one query per vehicle is the dominant latency cost in that path. Exposing the batch form as a first-class contract method — rather than leaving callers to loop — is what prevents the N+1 pattern from reappearing.

### 6.4 ETA Composition

ETA is a single indexed aggregate over the traversal matrix, not K lookups and not a model call:

```sql
-- repositories/traversal-matrix.repository.ts  (query text)

SELECT COALESCE(SUM(
         CASE
           WHEN m.sample_count >  $3 THEN m.ml_predicted_seconds
           WHEN m.sample_count >  0  THEN m.naive_avg_seconds
           ELSE s.distance_meters / $4          -- v_route_default (m/s)
         END
       ), 0) AS eta_seconds,
       SUM(m.variance_score)                    AS variance_total,
       MIN(m.sample_count)                      AS weakest_cell_support
FROM   route_segments s
LEFT   JOIN route_segment_traversal_matrix m
       ON m.segment_id  = s.segment_id
      AND m.hour_of_day = $1
      AND m.day_type    = $2
WHERE  s.segment_id = ANY($5::int[]);
```

- **Fallback lives in SQL, not in application code** — The tier selection is a property of the data (how well supported a cell is), so evaluating it where the data is avoids transferring rows only to discard most of their columns. It also guarantees the ETA path and the heatmap path apply identical tiers.
- **`weakest_cell_support` is returned deliberately** — It tells the client how much of this estimate rested on thin evidence, which is what a confidence indicator in the UI should be driven by — rather than a fabricated percentage.
- **`LEFT JOIN`, not `INNER`** — A segment with no matrix row at all must still contribute its distance-based estimate. An inner join would silently shorten the ETA by omitting unobserved segments, which is the most dangerous possible failure here because it produces a plausible-looking number.

### 6.5 Real-Time Broadcast

```typescript
// realtime/broadcast.scheduler.ts

export class BroadcastScheduler {
  constructor(
    private readonly positions: ILivePositionRepository,
    private readonly gateway: ISocketGateway,
    private readonly intervalMs: number,
  ) {}

  start(): void   // single interval timer, independent of connection count
  stop(): void
}

// realtime/socket.gateway.ts

export interface ISocketGateway {
  broadcast(frame: TelemetryBatchFrame): void;
  connectionCount(): number;
}
```

| Choice | Rationale |
| --- | --- |
| One timer for all clients, not one per connection | Read cost stays constant as viewers grow. This is the property the paper claims — serving latency isolated from viewer count — and it follows from this structure. |
| Batched frame, not per-vehicle events | One frame per interval rather than N events avoids per-message framing overhead and gives the client a coherent snapshot to interpolate between. |
| Delta frames after the first | Following the initial full snapshot, frames carry only vehicles whose position changed, which on a sparse network is a large reduction in payload for no added client complexity beyond a merge. |
| Gateway behind an interface | The scheduler is testable without a socket server, and the transport can change without touching scheduling logic. |

---

## 7. Service: Intelligence Job (Python)

A scheduled batch job, not a server. It reads the archive, produces a trained model, and materialises the traversal matrix. It is never on a request path.

### 7.1 Pipeline

```
archive ──► TrajectoryExtractor ──► CleaningPipeline ──► FeatureBuilder
                                                                  │
                                            ChronologicalSplitter ─┤
                                                                  ▼
                                                          IModel.fit()
                                                                  │
                                                                  ▼
        MatrixMaterialiser ──► route_segment_traversal_matrix (atomic swap)
```

```python
# shared/python/ecotransit_shared/contracts/intelligence.py

class ICleaningRule(ABC):
    @abstractmethod
    def apply(self, samples: DataFrame) -> DataFrame: ...

class IModel(ABC):
    @abstractmethod
    def fit(self, X: DataFrame, y: Series) -> FitReport: ...
    @abstractmethod
    def predict(self, X: DataFrame) -> ndarray: ...
    @abstractmethod
    def save(self, path: Path) -> None: ...
    @classmethod
    @abstractmethod
    def load(cls, path: Path) -> "IModel": ...

class IFallbackPolicy(ABC):
    @abstractmethod
    def resolve(self, cell: MatrixCell) -> ResolvedCell: ...
```

### 7.2 Components

| Component | Responsibility |
| --- | --- |
| `TrajectoryExtractor` | Match consecutive pings per vehicle to route segments, producing traversal durations |
| `CleaningPipeline` | Ordered `ICleaningRule` chain: `GpsDriftRule`, `ImplausibleSpeedRule` (>80 km/h), `DwellIntervalRule`, `OutlierDurationRule` |
| `FeatureBuilder` | Produce the feature frame: `segment_id`, `hour_of_day`, `day_type`, `distance_meters` |
| `ChronologicalSplitter` | Split by calendar time, never randomly. Exposed as its own class so the split policy cannot be bypassed accidentally |
| `RandomForestTravelTimeModel` | `IModel` implementation wrapping scikit-learn |
| `MatrixMaterialiser` | Enumerate the discrete space, predict in one vectorised call, apply `IFallbackPolicy`, write atomically |
| `EvaluationReporter` | MAE/RMSE for model, historical-average, and constant-velocity baselines, bucketed by time of day |

> **`day_type` must be in the feature set** — Paper draft 2 §V.B writes the feature tuple without `day_type`, while the surrounding text, the matrix schema, and the fallback logic all require it. The implementation includes it. Training without it would collapse weekday and weekend traffic into one average and leave a matrix dimension that varies no data.

### 7.3 Atomic Materialisation

```python
# Write to a staging table, then swap. Serving never observes a partial matrix.

async def materialise(self, cells: Iterable[ResolvedCell]) -> None:
    async with self._pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("TRUNCATE route_segment_traversal_matrix_staging")
            await conn.copy_records_to_table(
                "route_segment_traversal_matrix_staging", records=cells)
            await conn.execute("""
                ALTER TABLE route_segment_traversal_matrix
                    RENAME TO route_segment_traversal_matrix_old;
                ALTER TABLE route_segment_traversal_matrix_staging
                    RENAME TO route_segment_traversal_matrix;
                ALTER TABLE route_segment_traversal_matrix_old
                    RENAME TO route_segment_traversal_matrix_staging;
            """)
```

COPY rather than row-by-row INSERT, because the matrix is a full rewrite of tens of thousands of rows on every run. The rename swap inside a transaction means a commuter requesting an ETA mid-materialisation reads the previous complete matrix rather than a half-written one.

### 7.4 Architectural Choices

| Choice | Rationale |
| --- | --- |
| Vectorised prediction over the whole grid | scikit-learn predicts an entire frame far faster than looping per cell. Since the grid is enumerated anyway, one call replaces tens of thousands. |
| Fallback applied at write time, tiers also present at read time | Writing resolved values makes the matrix directly usable; keeping `sample_count` lets the read query re-derive tiers if the threshold changes without a full retrain. |
| Model artefacts versioned on disk with the fit report | Allows comparing successive trainings and rolling back a regression rather than discovering it in production ETAs. |
| Evaluation is part of the job, not a notebook | The paper's central claim is a measured comparison. Producing it as job output means the number in the paper and the number the system produces cannot diverge. |

---

## 8. Service: Staff Service (TypeScript)

Identity and field operations. Takes writes from vehicles in service, so it is designed for unreliable client connections and short request lifetimes.

### 8.1 Modules

| Module | Controller | Service | Repository |
| --- | --- | --- | --- |
| Authentication | `AuthController` | `AuthService` | `StaffRepository`, `SessionStore` |
| Shift binding | `ShiftController` | `ShiftService` | `ShiftAssignmentRepository`, `SessionStore` |
| Incident intake | `IncidentController` | `IncidentService` | `IncidentRepository` |
| Fallback position | `FallbackPositionController` | `FallbackPositionService` | (publishes to ingestion source) |

### 8.2 Authentication Flow

```typescript
// services/auth.service.ts

export class AuthService implements IAuthService {
  constructor(
    private readonly staff: IStaffRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenIssuer,
    private readonly sessions: ISessionStore,
    private readonly clock: IClock,
  ) {}

  async login(cmd: LoginCommand): Promise<AuthenticatedSession> {
    const record = await this.staff.findByEmployeeId(cmd.employeeId);
    if (!record) throw new UnauthorizedError('invalid_credentials');

    const valid = await this.hasher.verify(cmd.password, record.credentialHash);
    if (!valid) throw new UnauthorizedError('invalid_credentials');
    if (!record.isActive) throw new ForbiddenError('staff_inactive');

    const session = StaffSession.open(record, this.clock.now());
    await this.sessions.put(session.id, session, SESSION_TTL_SECONDS);
    const token = await this.tokens.issue(session.claims(), SESSION_TTL_SECONDS);
    return { session, token };
  }
}

// controllers/auth.controller.ts -- cookie handling is the controller's job,
// because it is an HTTP concern, not a business rule.

export class AuthController extends BaseController {
  login = this.handle(async (req, res) => {
    const { session, token } = await this.authService.login(
      LoginSchema.parse(req.body));
    setAuthCookie(res, token, SESSION_TTL_SECONDS);
    return { staffId: session.staffId, role: session.role };
  });
}
```

- **Identical error for unknown staff and wrong password** — Distinguishing them lets an attacker enumerate valid employee IDs. Both raise the same `UnauthorizedError` with the same code.
- **Cookie writing stays in the controller** — `setAuthCookie` touches the HTTP response, so it belongs to the layer that owns HTTP. `AuthService` returns a token and remains transport-agnostic.
- **Session in Redis, not only in the token** — A token alone cannot be revoked before expiry. A conductor who ends a shift, or whose access is withdrawn, must lose access immediately — which requires server-side session state.

### 8.3 Shift Binding

Binding a staff member to a vehicle and route for a shift is the operational core of this service. The invariant it must protect is one active assignment per vehicle and one per staff member at any moment; overlapping assignments would make incident attribution and any future telemetry authorisation ambiguous.

```typescript
export class ShiftService implements IShiftService {
  async bind(cmd: BindShiftCommand): Promise<ShiftAssignment> {
    return this.assignments.withTransaction(async (tx) => {
      const conflict = await this.assignments.findActiveConflict(
        cmd.staffId, cmd.vehicleId, tx);
      if (conflict) throw new ConflictError('shift_already_active');

      const assignment = ShiftAssignment.open(cmd, this.clock.now());
      await this.assignments.insert(assignment, tx);
      await this.sessions.attachVehicle(cmd.sessionId, cmd.vehicleId);
      return assignment;
    });
  }
}
```

*The conflict check and the insert run in one transaction against a database uniqueness constraint on active assignments. A check-then-insert without both is a race: two dispatchers binding the same vehicle a few milliseconds apart would both pass the check.*

### 8.4 Incident Intake

| Choice | Rationale |
| --- | --- |
| Write-optimised, acknowledged immediately | A conductor reporting a breakdown is in a bad situation on a poor connection. The endpoint validates, persists, and returns — notification fan-out to dispatchers happens after the response, not before it. |
| Incident attributed from the session, not the request body | Vehicle and staff identity come from the bound shift rather than client-supplied fields, so a report cannot be filed against another vehicle. |
| Client-supplied idempotency key | A retry on a flaky connection must not create a duplicate incident. The key is unique-constrained and a repeat returns the original record. |
| Free-text description kept, type constrained | An enumerated `incident_type` keeps the dispatcher queue filterable; free text preserves detail the enumeration did not anticipate. |

---

## 9. Service: Admin Service (TypeScript)

Read-heavy supervision plane for dispatchers and managers. Verifies tokens issued by the Staff Service; issues none of its own.

### 9.1 Modules

| Module | Service | Purpose |
| --- | --- | --- |
| Fleet supervision | `FleetService` | Live fleet matrix: positions from Redis joined with route and assignment context |
| Incident management | `IncidentManagementService` | Queue, filter, acknowledge, resolve; lifecycle transitions |
| Staff administration | `StaffAdminService` | Create, deactivate, and assign roles to staff records |
| Operational reporting | `ReportingService` | Coverage and schedule-adherence aggregates over the archive |

### 9.2 Architectural Choices

| Choice | Rationale |
| --- | --- |
| Separate connection pool, smaller and lower-priority | Admin aggregations are heavy and infrequent. An isolated, deliberately small pool means a manager running a month-long report cannot exhaust connections needed by conductors filing incidents. |
| Live fleet view over Socket.IO, reusing the gateway pattern | Dispatchers need continuous updates, not refresh buttons. The broadcast scheduler pattern from the API Gateway is reused rather than reimplemented. |
| Reporting reads the archive, never the live path | Historical aggregation touches only append-only data, so no report can contend with serving traffic. |
| Incident transitions modelled explicitly | `open` → `acknowledged` → `resolved` as a guarded transition on the entity rather than a free-form status column, so invalid jumps are rejected at the domain layer. |
| Role checks at the route boundary via `requireRole` | Authorisation is declared next to the route rather than scattered through service bodies, making the permission surface auditable in one pass. |

---

## 10. Client Applications

### 10.1 Commuter Web — Structure

```
services/javascript/web-commuter/src/
├── api/               # the only place fetch/socket calls exist
│   ├── client.ts
│   ├── transit.api.ts
│   └── socket.ts
├── state/             # store slices: transform, vehicles, search, selection
├── map/
│   ├── MapCanvas.tsx        # outer <svg>, owns viewport transform only
│   ├── MapBackground.tsx    # memoised: grid, stops, route polylines
│   ├── BusMarkerLayer.tsx   # subscribes to vehicle slice only
│   ├── HeatmapLayer.tsx     # memoised per (routeId, bucket)
│   └── useInterpolatedPositions.ts
├── panels/            # search, results, bus detail
└── components/        # presentational primitives
```

### 10.2 Render Isolation

The system broadcasts a telemetry frame every five seconds and the client interpolates marker positions between frames. Interpolation means an animation loop running continuously, not a single update per frame. If vehicle position and viewport transform share a state scope, that loop re-renders the grid, every stop, and every route polyline at animation frequency.

> **This is a correctness requirement, not an optimisation.** Smooth interpolation between 5-second frames is a behaviour the paper states. It is only achievable if the background layer is insulated from per-frame vehicle updates. Render isolation is therefore part of delivering a claim already made, and belongs in the specification rather than in a later performance pass.

| Rule | Implementation |
| --- | --- |
| Viewport transform and vehicle data never share an owner | `MapCanvas` owns the transform. Vehicle data is read by `BusMarkerLayer` through a store selector, so a position update does not re-render `MapCanvas`. |
| Background is memoised on transform alone | `MapBackground` receives transform, stops, and routes — none of which change on a ping — so it skips re-rendering while its sibling updates. |
| Interpolation mutates refs, not state | `useInterpolatedPositions` holds marker refs and writes transform attributes inside a `requestAnimationFrame` loop. Per-frame motion causes no React render at all. |
| Store selectors, not context | Context re-renders every consumer on any value change. Selector subscriptions re-render only components whose selected slice changed. |
| Incoming frames coalesce before reaching state | Frames are merged and flushed once per animation frame, so a burst cannot trigger multiple renders in one frame. |

*Layer order also matters for what the transform applies to: markers must stay constant-size while route geometry scales, so marker groups apply an inverse scale rather than inheriting the viewport scale directly.*

### 10.3 Staff Portal and Admin Dashboard

| Application | Notes |
| --- | --- |
| **Staff Portal** | Deliberately minimal: login, shift confirmation, incident form, fallback position toggle. Assumes a phone on an unreliable connection — forms hold local drafts and retry with the idempotency key rather than discarding input on failure. |
| **Admin Dashboard** | Fleet matrix reusing the same map layer components as the commuter client through the shared component package, plus an incident queue with lifecycle actions. Reuses rather than reimplements the map. |

---

## 11. Cross-Cutting Concerns

| Concern | Approach |
| --- | --- |
| Configuration | Schema-validated at boot in every service. A missing or malformed variable fails startup rather than the first request that needs it. |
| Error handling | One `AppError` hierarchy in `core-utils`; one error middleware per service maps it to status codes. No service invents its own error shape. |
| Logging | Structured JSON with a correlation id propagated from the edge through to repository calls, so one request is traceable across layers and, via the ingestion id, across languages. |
| Validation | Request DTOs validated at the controller boundary. Services assume valid input and state that assumption in their types rather than re-checking. |
| Caching | Static data (stops, routes, segments) cached in Redis with explicit invalidation on GTFS reimport. Live data is never cached beyond its TTL. |
| Connection pooling | Per-service pools sized to that service's traffic shape; pgBouncer in front if instance count grows. |
| Database migrations | Forward-only ordered SQL under `database/migrations`, applied by a single runner. No service creates or alters its own tables at startup. |
| Testing | Services tested against repository interfaces with in-memory implementations; repositories tested against a real PostgreSQL instance. No mocking framework substitutes for a real database in repository tests. |
| Time | `Asia/Kolkata` explicitly, everywhere. `hourOfDay` and `dayType` computed from one shared definition per language. |

---

## 12. Build Order

Ordered by dependency. Each phase names the condition that must hold before the next begins.

| # | Phase | Complete When |
| --- | --- | --- |
| 0 | Monorepo scaffolding, shared packages, migration runner, CI | A trivial service in each language builds, lints, and consumes a shared package |
| 1 | Static GTFS import: stops, routes, trips, stop_times; 25 m stop clustering; route_stops and route_segments generation | Begumpur and Rithala clusters each collapse to one canonical stop; no segment shorter than the clustering radius exists |
| 2 | Ingestion Worker: contracts, engine, GTFS-RT source, Protobuf parser, validation chain, Redis and archive sinks | Live keys present in Redis with correct TTL expiry; archive growing from real feed data |
| 3 | Ingestion Worker: MQTT source and JSON parser registered alongside the existing pipeline | Both sources feed the same engine with no engine modification — the Open/Closed claim demonstrated |
| 4 | API Gateway: layering, repositories, stop and route search, broadcast scheduler | Commuter client renders live vehicles and resolves an origin→destination query |
| 5 | Commuter Web: map layers, render isolation, interpolation, search panels | Markers interpolate smoothly with no background re-render during animation |
| 6 | Archive accumulation to a usable corpus | Coverage per (segment, hour, day_type) exceeds N_threshold across primary corridors |
| 7 | Intelligence Job: extraction, cleaning, chronological split, training, materialisation, evaluation report | Matrix populated atomically; MAE/RMSE reported per time bucket against both baselines |
| 8 | API Gateway: ETA range-sum endpoint and heatmap endpoint; client display | ETA served entirely from matrix lookup; no inference call on any request path |
| 9 | Staff Service: auth, shift binding, incident intake | A conductor can log in, bind to a vehicle, and file an attributed incident |
| 10 | Admin Service and Admin Dashboard | Fleet matrix streams live; incident queue supports full lifecycle |
| 11 | Conductor fallback: HTTPS position source into the ingestion pipeline | A staff device publishes positions consumed by the same engine as MQTT and GTFS-RT |

> **Phase 6 governs the schedule.** Everything from phase 7 onward is blocked on wall-clock data accumulation, which no amount of development speed shortens. Collection must begin the moment phase 2 is stable and run continuously in parallel with phases 4, 5, 9, and 10 — not be sequenced after them.

---

## 13. Open Decisions

| Item | Why It Must Be Settled | Blocks |
| --- | --- | --- |
| Direction-awareness in nearest-stop resolution | The current approach finds the geometrically nearest stop without distinguishing a vehicle approaching a stop from one that has just passed it, which can invert the remaining-segment set and produce a confidently wrong ETA | Phase 4 |
| `N_threshold` value | Determines how much of the matrix is ML-served versus naive-served, and therefore how strong the ML claim actually is. Must be chosen and reported, not left implicit | Phase 7 |
| `route_segments` final column set | Assumed here; needs confirmation against the live schema before segment generation is written | Phase 1 |
| `display_name` served end-to-end | Unconfirmed whether API responses carry resolved names or raw `stop_name` | Phase 4 |
| `v_route_default` value(s) | Whether the zero-sample fallback speed is system-wide or per-route, and what value it takes | Phase 7 |
| MQTT topic authority | Which component assigns and validates `bus:route_id:vehicle_id` topics once real hardware publishes | Phase 3 |

*Two corrections to the conference paper are also outstanding and independent of the code: the §V.B feature tuple omits `day_type`, and the §V.D fallback conditions overlap with the ML branch inverted. Both are described in the v1.1 architecture document.*

---

## Appendix A: OTD Data Collection Tooling

Two scripts implement Phase 2's GTFS-RT source in practice — a collector that polls Delhi OTD and archives raw snapshots, and a combiner that flattens and cleans those snapshots into a single training-ready CSV. These are concrete artifacts, not a redesign of `GtfsRealtimeSource` from §5 — they are the operational path by which real telemetry reaches the Historical Archive before the Ingestion Worker's Redis/Postgres sinks (§5.2–§5.4) are wired in, and remain useful afterward as an independent archival/backfill tool.

### A.1 Collector (`otd_collector.py`)

Polls `VehiclePositions.pb` from Delhi OTD every `POLL_INTERVAL` seconds (default 10s), decodes the GTFS-RT Protobuf feed, and appends one JSON snapshot per poll into a per-run file under `otd_data/`.

**Raw file shape:**

```json
{
  "started_at": "2026-09-30T10:00:00",
  "snapshots": [
    {
      "collected_at": "2026-09-30T10:00:10",
      "vehicle_count": 842,
      "vehicles": [
        {
          "entity_id": "...",
          "vehicle": { "id": "...", "label": "...", "license_plate": "..." },
          "trip": { "trip_id": "...", "route_id": "...", "direction_id": 0 },
          "position": { "latitude": 28.65, "longitude": 77.23, "bearing": 90.0, "speed": 8.3 },
          "timestamp": 1759228810
        }
      ]
    }
  ]
}
```

**Known limitation carried into the raw data:** `feed_to_dict` checks `HasField` only at the group level (`vehicle`, `trip`, `position`), not on individual scalar sub-fields such as `speed` or `bearing`. Protobuf returns `0.0` for an unset scalar, so a recorded `speed` of `0.0` cannot be distinguished from "field never set by the feed." This cannot be recovered after the fact — it is handled downstream as a flag, not a fix (see A.2).

### A.2 Combiner (`combine_otd_snapshots.py`)

Flattens every vehicle observation across every collected file into one row, cleans the result, and writes a single CSV — the direct input to the Intelligence Job's `TrajectoryExtractor` (§7.2).

**Output schema:**

| Column | Type | Notes |
| --- | --- | --- |
| `source_file` | str | traceability to the raw JSON |
| `collected_at` | datetime | poller's fetch time |
| `gtfs_timestamp` | int | epoch seconds from the feed — authoritative time |
| `gtfs_datetime_ist` | datetime | derived, `Asia/Kolkata` |
| `entity_id` | str |  |
| `vehicle_id` | str | primary key for a physical bus |
| `vehicle_label` | str |  |
| `license_plate` | str | often empty in this feed |
| `trip_id` | str |  |
| `route_id` | str |  |
| `direction_id` | Int64 | nullable |
| `latitude` / `longitude` | float |  |
| `bearing` | float | subject to the 0.0-ambiguity noted in A.1 |
| `speed` | float | m/s; subject to the same ambiguity |
| `is_speed_suspect` | bool | `True` if speed is null, ≤0, or >34 m/s (\~120 km/h) — **flagged, not dropped** |

**Cleaning pipeline, applied in order:**

1. **Drop rows with no position** — `latitude`/`longitude` missing or unparseable.
2. **Drop rows with no `vehicle_id`** — nothing downstream can attribute an unidentified position.
3. **Bounding-box filter** — reject coordinates outside `28.30–28.95°N, 76.80–77.55°E` (Delhi NCR, loose on purpose — this catches GPS garbage such as `(0,0)`, not legitimate outer-NCR routes).
4. **Deduplicate on `(vehicle_id, gtfs_timestamp)`** — the poll interval (10s) is often shorter than the feed's real refresh rate, so consecutive polls frequently capture the same underlying GTFS-RT record. Left in, duplicates would bias any travel-time statistic toward the polling cadence rather than the feed's actual update rate.
5. **Sort by `vehicle_id`, then `gtfs_timestamp`** — the ordering `TrajectoryExtractor` needs to match consecutive pings to segments.
6. **Flag, don't drop, suspect speed** — per the A.1 caveat, a `speed` of exactly `0.0` may be a genuine stop or an unset field. Deleting these rows would silently remove real stationary-bus samples; flagging preserves them for inspection or downstream exclusion at the caller's discretion.

**Usage:**

```bash
python combine_otd_snapshots.py --input-dir otd_data --output otd_combined.csv
```

Prints a row-count breakdown at each cleaning stage so data loss at any step is visible rather than silent.