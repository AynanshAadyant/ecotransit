# EcoTransit — API Gateway Service (`services/javascript/api-gateway`)

The **API Gateway** is a TypeScript / Node.js service providing commuter-facing REST endpoints and real-time Socket.IO telemetry broadcast channels for live bus tracking, spatial stop resolution, and predicted ETA querying.

---

## 1. Architectural Highlights

- **Pure Translation Layer**: Controllers translate HTTP into domain calls and domain results into HTTP envelopes (`ok`, `created`, `noContent`). Business logic resides strictly in services.
- **Dependency Inversion**: Dependencies point inward:
  `Routes -> Controllers -> Services -> Repositories -> Data Access Drivers`.
- **Zero Inference Overhead**: Serves ETA queries directly via range-sum lookups over the precomputed `route_segment_traversal_matrix` in PostgreSQL. No machine learning inference is performed on any request path.
- **Real-Time Broadcast**: Socket.IO batch scheduler publishes live positions to connected commuters at regular intervals.

---

## 2. Directory Layout

```
services/javascript/api-gateway/
├── src/
│   ├── index.ts             # Service entrypoint and HTTP server bootstrap
│   ├── routes/              # Express route declarations (URL -> controller binding)
│   ├── controllers/         # HTTP input/output translation controllers
│   ├── services/            # Commuter domain service business logic
│   └── repositories/        # Repository implementations accessing PostgreSQL & Redis
├── package.json             # Workspace package definition
├── tsconfig.json            # Service TypeScript configuration
└── README.md                # This documentation
```

---

## 3. Environment Variables Reference

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `PORT_API_GATEWAY` | `number` | `4000` | Port for the API Gateway HTTP server |
| `POSTGRES_HOST` | `string` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `number` | `5432` | PostgreSQL port |
| `DATABASE_NAME` | `string` | `ecotransit` | Database name |
| `REDIS_HOST` | `string` | `localhost` | Redis host |
| `REDIS_PORT` | `number` | `6379` | Redis port |

---

## 4. Running the Service

### Development Mode
```bash
npm run dev --workspace=services/javascript/api-gateway
```

### Production Build & Run
```bash
npm run build
npm start --workspace=services/javascript/api-gateway
```

---

## 5. Testing & Verification

Run infrastructure and unit tests:
```bash
npm run test:infra
npm run typecheck
npm run lint
```
