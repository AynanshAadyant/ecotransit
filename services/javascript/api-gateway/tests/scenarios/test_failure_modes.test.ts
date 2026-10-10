import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SystemClock, NotFoundError, AppError } from '@ecotransit/core-utils';
import {
  MockLivePositionRepository,
  MockStopRepository,
  MockRouteRepository,
  MockRouteSegmentRepository,
  MockTraversalMatrixRepository,
} from '../fixtures/mock-repositories.js';
import { StopService } from '../../src/services/stop.service.js';
import { RouteService } from '../../src/services/route.service.js';
import { VehicleService } from '../../src/services/vehicle.service.js';
import { EtaService } from '../../src/services/eta.service.js';

describe('Scenario Failure Mode Tests: API Gateway Resiliency', () => {
  let livePosRepo: MockLivePositionRepository;
  let stopRepo: MockStopRepository;
  let routeRepo: MockRouteRepository;
  let segmentRepo: MockRouteSegmentRepository;
  let matrixRepo: MockTraversalMatrixRepository;
  let clock: SystemClock;

  let stopService: StopService;
  let routeService: RouteService;
  let vehicleService: VehicleService;
  let etaService: EtaService;

  beforeEach(() => {
    livePosRepo = new MockLivePositionRepository();
    stopRepo = new MockStopRepository();
    routeRepo = new MockRouteRepository();
    segmentRepo = new MockRouteSegmentRepository();
    matrixRepo = new MockTraversalMatrixRepository();
    clock = new SystemClock();

    stopService = new StopService(stopRepo);
    routeService = new RouteService(routeRepo, stopRepo);
    vehicleService = new VehicleService(livePosRepo);
    etaService = new EtaService(livePosRepo, stopRepo, segmentRepo, matrixRepo, clock);
  });

  it('should handle simulated database crash when searching stops without process termination', async () => {
    stopRepo.shouldFail = true;

    await assert.rejects(
      () => stopService.searchStops('Connaught'),
      (err) => err instanceof Error && err.message.includes('Simulated Database query error'),
    );
  });

  it('should handle simulated Redis outage when fetching live fleet without crashing vehicle service', async () => {
    livePosRepo.shouldFail = true;

    await assert.rejects(
      () => vehicleService.getAllLiveVehicles(),
      (err) => err instanceof Error && err.message.includes('Simulated Redis connection failure'),
    );
  });

  it('should return 404 NotFoundError when route lookup fails for invalid route ID', async () => {
    routeRepo.routes.clear();

    await assert.rejects(
      () => routeService.getRouteById('9999_INVALID'),
      (err) => err instanceof NotFoundError,
    );
  });

  it('should handle traversal matrix failure gracefully during ETA calculation', async () => {
    livePosRepo.positions.set('BUS_TEST', {
      vehicleId: 'BUS_TEST',
      routeId: '419',
      latitude: 28.6315,
      longitude: 77.2167,
      timestamp: 1000,
      updatedAt: 1000,
    });

    stopRepo.routeStopSequences.set('419', [
      { stopId: 'STOP_1', sequence: 1 },
      { stopId: 'STOP_2', sequence: 2 },
    ]);

    segmentRepo.segments.set('419', [
      { segmentId: 1, routeId: '419', fromStopId: 'STOP_1', toStopId: 'STOP_2', sequence: 1, distanceMeters: 500 },
    ]);

    matrixRepo.shouldFail = true;

    await assert.rejects(
      () => etaService.getEtaForVehicle({ vehicleId: 'BUS_TEST', targetStopId: 'STOP_2' }),
      (err) => err instanceof Error && err.message.includes('Simulated Database query error'),
    );
  });
});
