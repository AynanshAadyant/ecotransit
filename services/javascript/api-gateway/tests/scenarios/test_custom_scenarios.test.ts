import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MockStopRepository,
  MockRouteRepository,
} from '../fixtures/mock-repositories.js';
import { RouteService } from '../../src/services/route.service.js';

describe('Custom Scenario Tests: Journeys and Direction Math', () => {
  let stopRepo: MockStopRepository;
  let routeRepo: MockRouteRepository;
  let routeService: RouteService;

  beforeEach(() => {
    stopRepo = new MockStopRepository();
    routeRepo = new MockRouteRepository();
    routeService = new RouteService(routeRepo, stopRepo);

    // Setup linear route stops: Stop 1 -> Stop 2 -> Stop 3
    stopRepo.stops.set('STOP_1', { stopId: 'STOP_1', stopName: 'Stop One', latitude: 28.60, longitude: 77.20 });
    stopRepo.stops.set('STOP_2', { stopId: 'STOP_2', stopName: 'Stop Two', latitude: 28.61, longitude: 77.20 });
    stopRepo.stops.set('STOP_3', { stopId: 'STOP_3', stopName: 'Stop Three', latitude: 28.62, longitude: 77.20 });

    stopRepo.routeStopSequences.set('R_NORTH', [
      { stopId: 'STOP_1', sequence: 1 },
      { stopId: 'STOP_2', sequence: 2 },
      { stopId: 'STOP_3', sequence: 3 },
    ]);
  });

  it('should advance to next downstream stop sequence when vehicle bearing indicates bus is past closest stop', async () => {
    // Vehicle is located slightly north of STOP_2 at lat 28.6105, moving North (bearing 0 degrees)
    // STOP_2 is at lat 28.6100 (behind vehicle).
    const nearest = await stopRepo.findNearestOnRoute('R_NORTH', 28.6105, 77.20, 0);

    // Because dot product is negative (STOP_2 is behind moving bus), nearest should resolve to STOP_3 (sequence 3)
    assert.equal(nearest.stopId, 'STOP_3');
    assert.equal(nearest.stopSequence, 3);
  });

  it('should resolve direct journeys by coordinate search between nearby origin and destination stops', async () => {
    // Setup journey option
    routeRepo.directJourneys = [
      {
        route: { routeId: 'R_NORTH', routeShortName: 'RN', routeLongName: 'Route North' },
        originStop: stopRepo.stops.get('STOP_1')!,
        destinationStop: stopRepo.stops.get('STOP_3')!,
        originSequence: 1,
        destinationSequence: 3,
        stopsBetween: 2,
      },
    ];

    const journeys = await routeService.findJourneysByCoordinates(
      28.6001, 77.2001, // near STOP_1
      28.6201, 77.2001, // near STOP_3
      500,
    );

    assert.equal(journeys.length, 1);
    assert.equal(journeys[0]?.route.routeId, 'R_NORTH');
    assert.equal(journeys[0]?.stopsBetween, 2);
  });
});
