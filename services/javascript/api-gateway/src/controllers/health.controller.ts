import { BaseController, type IClock } from '@ecotransit/core-utils';
import type { Pool } from 'pg';
import type { RedisClientType } from 'redis';
import type { ISocketGateway } from '@ecotransit/contracts';

export class HealthController extends BaseController {
  constructor(
    private readonly pool: Pool,
    private readonly redisClient: RedisClientType,
    private readonly gateway: ISocketGateway,
    private readonly clock: IClock,
  ) {
    super();
  }

  getHealth = this.handle(async () => {
    let dbStatus = 'healthy';
    let redisStatus = 'healthy';

    try {
      await this.pool.query('SELECT 1');
    } catch {
      dbStatus = 'unhealthy';
    }

    try {
      await this.redisClient.ping();
    } catch {
      redisStatus = 'unhealthy';
    }

    const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      details: {
        service: 'api-gateway',
        database: dbStatus,
        redis: redisStatus,
        activeSocketClients: this.gateway.connectionCount(),
        epochSeconds: this.clock.epochSeconds(),
        bucket: this.clock.bucket(),
      },
    };
  });
}
