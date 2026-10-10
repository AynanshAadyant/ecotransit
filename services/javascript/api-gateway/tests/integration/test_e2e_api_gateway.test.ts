import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import type { Pool } from 'pg';
import type { RedisClientType } from 'redis';
import { SystemClock } from '@ecotransit/core-utils';
import {
  MockLivePositionRepository,
  MockStopRepository,
  MockRouteRepository,
  MockRouteSegmentRepository,
  MockTraversalMatrixRepository,
} from '../fixtures/mock-repositories.js';
import {
  StopService,
  RouteService,
  VehicleService,
  EtaService,
} from '../../src/services/index.js';
import {
  HealthController,
  StopController,
  RouteController,
  VehicleController,
  EtaController,
} from '../../src/controllers/index.js';
import { SocketGateway, BroadcastScheduler } from '../../src/realtime/index.js';
import { createApp } from '../../src/app.js';
import type { ServiceContainer } from '../../src/container.js';
import type { TelemetryBatchFrame } from '@ecotransit/contracts';

describe('Integration Test: API Gateway End-to-End REST & Socket.IO', () => {
  let server: http.Server;
  let io: SocketIOServer;
  let clientSocket: ClientSocketType;
  let baseUrl: string;
  let livePosRepo: MockLivePositionRepository;
  let stopRepo: MockStopRepository;
  let routeRepo: MockRouteRepository;
  let segmentRepo: MockRouteSegmentRepository;
  let matrixRepo: MockTraversalMatrixRepository;
  let scheduler: BroadcastScheduler;

  before(async () => {
    livePosRepo = new MockLivePositionRepository();
    stopRepo = new MockStopRepository();
    routeRepo = new MockRouteRepository();
    segmentRepo = new MockRouteSegmentRepository();
    matrixRepo = new MockTraversalMatrixRepository();
    const clock = new SystemClock();

    // Populate test data
    stopRepo.stops.set('STOP_101', {
      stopId: 'STOP_101',
      stopName: 'Kashmere Gate',
      latitude: 28.6665,
      longitude: 77.23,
    });
    routeRepo.routes.set('419', {
      routeId: '419',
      routeShortName: '419',
      routeLongName: 'Route 419',
      routeType: 3,
    });
    livePosRepo.positions.set('DL1PC8888', {
      vehicleId: 'DL1PC8888',
      routeId: '419',
      latitude: 28.6665,
      longitude: 77.23,
      speed: 12.0,
      timestamp: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const stopService = new StopService(stopRepo);
    const routeService = new RouteService(routeRepo, stopRepo);
    const vehicleService = new VehicleService(livePosRepo);
    const etaService = new EtaService(livePosRepo, stopRepo, segmentRepo, matrixRepo, clock);

    server = http.createServer();
    io = new SocketIOServer(server, { cors: { origin: '*' } });
    const socketGateway = new SocketGateway(io);
    scheduler = new BroadcastScheduler(livePosRepo, socketGateway, 1000, clock);

    const mockPool = { query: async () => ({ rows: [] }) } as unknown as Pool;
    const mockRedis = { ping: async () => 'PONG' } as unknown as RedisClientType;

    const container: ServiceContainer = {
      config: {
        PORT_API_GATEWAY: 0,
        CORS_ORIGIN: '*',
        BROADCAST_INTERVAL_MS: 1000,
        DEFAULT_ROUTE_SPEED_MS: 8.33,
        MIN_SAMPLE_COUNT_ML_THRESHOLD: 30,
        DELHI_BBOX_MIN_LAT: 28.3,
        DELHI_BBOX_MAX_LAT: 28.95,
        DELHI_BBOX_MIN_LON: 76.8,
        DELHI_BBOX_MAX_LON: 77.55,
      },
      pool: mockPool,
      redisClient: mockRedis,
      clock,
      livePosRepo: livePosRepo as unknown as ServiceContainer['livePosRepo'],
      stopRepo: stopRepo as unknown as ServiceContainer['stopRepo'],
      routeRepo: routeRepo as unknown as ServiceContainer['routeRepo'],
      segmentRepo: segmentRepo as unknown as ServiceContainer['segmentRepo'],
      matrixRepo: matrixRepo as unknown as ServiceContainer['matrixRepo'],
      stopService,
      routeService,
      vehicleService,
      etaService,
      healthController: new HealthController(mockPool, mockRedis, socketGateway, clock),
      stopController: new StopController(stopService),
      routeController: new RouteController(routeService),
      vehicleController: new VehicleController(vehicleService),
      etaController: new EtaController(etaService),
      socketGateway,
      broadcastScheduler: scheduler,
    };

    const app = createApp(container);
    server.on('request', app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    scheduler.stop();
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should respond to GET /api/health with healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; details: { service: string } };
    assert.equal(body.status, 'healthy');
    assert.equal(body.details.service, 'api-gateway');
  });

  it('should return nearby stops on GET /api/stops/nearby', async () => {
    const res = await fetch(`${baseUrl}/api/stops/nearby?lat=28.6665&lon=77.23&radius=1000`);
    assert.equal(res.status, 200);
    const stops = (await res.json()) as Array<{ stopId: string }>;
    assert.ok(Array.isArray(stops));
    assert.equal(stops.length, 1);
    assert.equal(stops[0]?.stopId, 'STOP_101');
  });

  it('should list all live vehicles on GET /api/vehicles/live', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/live`);
    assert.equal(res.status, 200);
    const vehicles = (await res.json()) as Array<{ vehicleId: string }>;
    assert.ok(Array.isArray(vehicles));
    assert.equal(vehicles.length, 1);
    assert.equal(vehicles[0]?.vehicleId, 'DL1PC8888');
  });

  it('should establish Socket.IO client connection and receive telemetry_frame', async () => {
    clientSocket = ClientSocket(baseUrl, { reconnection: false });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => resolve());
      clientSocket.on('connect_error', (err) => reject(err));
    });

    assert.equal(clientSocket.connected, true);

    const frameReceived = new Promise<TelemetryBatchFrame>((resolve) => {
      clientSocket.on('telemetry_frame', (frame: TelemetryBatchFrame) => {
        resolve(frame);
      });
    });

    // Manually trigger broadcast tick
    await scheduler.tick();

    const frame = await frameReceived;
    assert.ok(frame);
    assert.equal(frame.frameType, 'full');
    assert.equal(frame.vehicles.length, 1);
    assert.equal(frame.vehicles[0]?.vehicleId, 'DL1PC8888');
  });
});
