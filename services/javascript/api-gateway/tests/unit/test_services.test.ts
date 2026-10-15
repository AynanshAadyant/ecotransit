import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SystemClock, NotFoundError, ValidationError } from '@ecotransit/core-utils';
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

describe('Unit Tests: Domain Services', () => {
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

    // Setup seed stops
    stopRepo.stops.set('STOP_A', {
      stopId: 'STOP_A',
      stopName: 'Connaught Place',
      latitude: 28.6315,
      longitude: 77.2167,
    });
    stopRepo.stops.set('STOP_B', {
      stopId: 'STOP_B',
      stopName: 'Rajiv Chowk',
      latitude: 28.6328,
      longitude: 77.2195,
    });
    stopRepo.stops.set('STOP_C', {
      stopId: 'STOP_C',
      stopName: 'New Delhi Railway Station',
      latitude: 28.643,
      longitude: 77.2194,
    });

    // Setup seed routes
    routeRepo.routes.set('419', {
      routeId: '419',
      routeShortName: '419',
      routeLongName: 'Old Delhi Railway Station to Ambedkar Nagar',
      routeType: 3,
    });

    stopRepo.routeStopSequences.set('419', [
      { stopId: 'STOP_A', sequence: 1 },
      { stopId: 'STOP_B', sequence: 2 },
      { stopId: 'STOP_C', sequence: 3 },
    ]);

    segmentRepo.segments.set('419', [
      { segmentId: 101, routeId: '419', fromStopId: 'STOP_A', toStopId: 'STOP_B', sequence: 1, distanceMeters: 500 },
      { segmentId: 102, routeId: '419', fromStopId: 'STOP_B', toStopId: 'STOP_C', sequence: 2, distanceMeters: 1200 },
    ]);
  });

  describe('StopService', () => {
    it('should retrieve nearby stops within search radius', async () => {
      const stops = await stopService.getNearbyStops(28.6315, 77.2167, 1000);
      assert.ok(stops.length >= 2);
      assert.equal(stops[0]?.stopId, 'STOP_A');
    });

    it('should search stops by case-insensitive name query', async () => {
      const results = await stopService.searchStops('connaught');
      assert.equal(results.length, 1);
      assert.equal(results[0]?.stopId, 'STOP_A');
    });

    it('should throw NotFoundError for non-existent stop ID', async () => {
      await assert.rejects(
        () => stopService.getStopById('NON_EXISTENT'),
        (err) => err instanceof NotFoundError,
      );
    });
  });

  describe('RouteService', () => {
    it('should list all registered routes', async () => {
      const routes = await routeService.getAllRoutes();
      assert.equal(routes.length, 1);
      assert.equal(routes[0]?.routeId, '419');
    });

    it('should find direct journeys between origin and destination stops', async () => {
      routeRepo.directJourneys = [
        {
          route: { routeId: '419', routeShortName: '419', routeLongName: 'Route 419' },
          originStop: stopRepo.stops.get('STOP_A')!,
          destinationStop: stopRepo.stops.get('STOP_C')!,
          originSequence: 1,
          destinationSequence: 3,
          stopsBetween: 2,
        },
      ];

      const journeys = await routeService.findJourneys('STOP_A', 'STOP_C');
      assert.equal(journeys.length, 1);
      assert.equal(journeys[0]?.stopsBetween, 2);
    });

    it('should reject journey query if origin and destination stops are identical', async () => {
      await assert.rejects(
        () => routeService.findJourneys('STOP_A', 'STOP_A'),
        (err) => err instanceof ValidationError,
      );
    });
  });

  describe('VehicleService', () => {
    it('should return empty list when no vehicles are live', async () => {
      const vehicles = await vehicleService.getAllLiveVehicles();
      assert.equal(vehicles.length, 0);
    });

    it('should fetch live vehicle by ID', async () => {
      livePosRepo.positions.set('DL1PC1001', {
        vehicleId: 'DL1PC1001',
        routeId: '419',
        latitude: 28.6315,
        longitude: 77.2167,
        timestamp: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });

      const vehicle = await vehicleService.getLiveVehicleById('DL1PC1001');
      assert.equal(vehicle.vehicleId, 'DL1PC1001');
    });

    it('should throw NotFoundError for inactive vehicle', async () => {
      await assert.rejects(
        () => vehicleService.getLiveVehicleById('INACTIVE'),
        (err) => err instanceof NotFoundError,
      );
    });
  });

  describe('EtaService', () => {
    it('should calculate vehicle range-sum ETA to downstream target stop', async () => {
      livePosRepo.positions.set('DL1PC1001', {
        vehicleId: 'DL1PC1001',
        routeId: '419',
        latitude: 28.6315,
        longitude: 77.2167,
        bearing: 90.0,
        timestamp: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });

      const eta = await etaService.getEtaForVehicle({
        vehicleId: 'DL1PC1001',
        targetStopId: 'STOP_C',
      });

      assert.ok(eta.etaSeconds > 0);
      assert.equal(eta.weakestCellSupport, 45);
    });

    it('should throw NotFoundError when calculating ETA for offline vehicle', async () => {
      await assert.rejects(
        () => etaService.getEtaForVehicle({ vehicleId: 'OFFLINE_BUS', targetStopId: 'STOP_C' }),
        (err) => err instanceof NotFoundError,
      );
    });

    it('should throw ValidationError when target stop is not downstream', async () => {
      livePosRepo.positions.set('DL1PC1001', {
        vehicleId: 'DL1PC1001',
        routeId: '419',
        latitude: 28.643, // Already at STOP_C
        longitude: 77.2194,
        timestamp: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });

      await assert.rejects(
        () => etaService.getEtaForVehicle({ vehicleId: 'DL1PC1001', targetStopId: 'STOP_A' }),
        (err) => err instanceof ValidationError,
      );
    });
  });
});
