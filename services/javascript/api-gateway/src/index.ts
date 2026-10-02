import express from 'express';
import { createLogger, ok, errorMiddleware, SystemClock } from '@ecotransit/core-utils';
import type { HealthStatus, VehiclePosition } from '@ecotransit/contracts';

const app = express();
const logger = createLogger('api-gateway');
const clock = new SystemClock();

app.use(express.json());

app.get('/health', (_req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    details: {
      service: 'api-gateway',
      epochSeconds: clock.epochSeconds(),
      bucket: clock.bucket(),
    },
  };
  ok(res, health);
});

app.get('/api/sample-vehicle', (_req, res) => {
  const sample: VehiclePosition = {
    vehicleId: 'DL1PC8888',
    routeId: '419',
    latitude: 28.6139,
    longitude: 77.209,
    timestamp: clock.epochSeconds(),
  };
  ok(res, sample);
});

app.use(errorMiddleware);

const port = process.env['PORT_API_GATEWAY'] || 4000;

export { app };

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(port, () => {
    logger.info({ port }, `API Gateway running on port ${port}`);
  });
}
