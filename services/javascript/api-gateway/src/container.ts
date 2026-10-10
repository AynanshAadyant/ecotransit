import type { Pool } from 'pg';
import type { RedisClientType } from 'redis';
import type { Server as SocketIOServer } from 'socket.io';
import { SystemClock, type IClock } from '@ecotransit/core-utils';
import type { ApiGatewayConfig } from './config.js';
import {
  RedisLivePositionRepository,
  PostgresStopRepository,
  PostgresRouteRepository,
  PostgresRouteSegmentRepository,
  PostgresTraversalMatrixRepository,
} from './repositories/index.js';
import {
  StopService,
  RouteService,
  VehicleService,
  EtaService,
} from './services/index.js';
import {
  HealthController,
  StopController,
  RouteController,
  VehicleController,
  EtaController,
} from './controllers/index.js';
import { SocketGateway, BroadcastScheduler } from './realtime/index.js';

export interface ServiceContainer {
  config: ApiGatewayConfig;
  pool: Pool;
  redisClient: RedisClientType;
  clock: IClock;

  // Repositories
  livePosRepo: RedisLivePositionRepository;
  stopRepo: PostgresStopRepository;
  routeRepo: PostgresRouteRepository;
  segmentRepo: PostgresRouteSegmentRepository;
  matrixRepo: PostgresTraversalMatrixRepository;

  // Services
  stopService: StopService;
  routeService: RouteService;
  vehicleService: VehicleService;
  etaService: EtaService;

  // Controllers
  healthController: HealthController;
  stopController: StopController;
  routeController: RouteController;
  vehicleController: VehicleController;
  etaController: EtaController;

  // Realtime
  socketGateway: SocketGateway;
  broadcastScheduler: BroadcastScheduler;
}

export function createContainer(
  config: ApiGatewayConfig,
  pool: Pool,
  redisClient: RedisClientType,
  io: SocketIOServer,
  clock: IClock = new SystemClock(),
): ServiceContainer {
  // 1. Repositories
  const livePosRepo = new RedisLivePositionRepository(redisClient);
  const stopRepo = new PostgresStopRepository(pool);
  const routeRepo = new PostgresRouteRepository(pool);
  const segmentRepo = new PostgresRouteSegmentRepository(pool);
  const matrixRepo = new PostgresTraversalMatrixRepository(
    pool,
    config.MIN_SAMPLE_COUNT_ML_THRESHOLD,
    config.DEFAULT_ROUTE_SPEED_MS,
  );

  // 2. Domain Services
  const stopService = new StopService(stopRepo);
  const routeService = new RouteService(routeRepo, stopRepo);
  const vehicleService = new VehicleService(livePosRepo);
  const etaService = new EtaService(livePosRepo, stopRepo, segmentRepo, matrixRepo, clock);

  // 3. Realtime Engine
  const socketGateway = new SocketGateway(io);
  const broadcastScheduler = new BroadcastScheduler(
    livePosRepo,
    socketGateway,
    config.BROADCAST_INTERVAL_MS,
    clock,
  );

  // 4. Controllers
  const healthController = new HealthController(pool, redisClient, socketGateway, clock);
  const stopController = new StopController(stopService);
  const routeController = new RouteController(routeService);
  const vehicleController = new VehicleController(vehicleService);
  const etaController = new EtaController(etaService);

  return {
    config,
    pool,
    redisClient,
    clock,
    livePosRepo,
    stopRepo,
    routeRepo,
    segmentRepo,
    matrixRepo,
    stopService,
    routeService,
    vehicleService,
    etaService,
    healthController,
    stopController,
    routeController,
    vehicleController,
    etaController,
    socketGateway,
    broadcastScheduler,
  };
}
