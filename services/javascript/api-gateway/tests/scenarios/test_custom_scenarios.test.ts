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

  it('should match all routes between origin and destination stop clusters when multiple stops exist in the cluster', async () => {
    // Setup cluster stops around Begumpur (lat ~28.721, lon ~77.065)
    stopRepo.stops.set('STOP_BEG_1', { stopId: 'STOP_BEG_1', stopName: 'Begumpur', latitude: 28.7217, longitude: 77.0649 });
    stopRepo.stops.set('STOP_BEG_2', { stopId: 'STOP_BEG_2', stopName: 'Police Station Begumpur', latitude: 28.7224, longitude: 77.0714 });

    // Setup cluster stops around Rithala (lat ~28.719, lon ~77.108)
    stopRepo.stops.set('STOP_RIT_1', { stopId: 'STOP_RIT_1', stopName: 'Rithala Metro Station', latitude: 28.7196, longitude: 77.1085 });
    stopRepo.stops.set('STOP_RIT_2', { stopId: 'STOP_RIT_2', stopName: 'Rithala Village', latitude: 28.7171, longitude: 77.1014 });

    // Route 102A serves STOP_BEG_2 -> STOP_RIT_2
    // Route 971 serves STOP_BEG_1 -> STOP_RIT_1
    // Route 990 serves STOP_BEG_2 -> STOP_RIT_1
    routeRepo.directJourneys = [
      {
        route: { routeId: '102A', routeShortName: '102A', routeLongName: 'Route 102A' },
        originStop: stopRepo.stops.get('STOP_BEG_2')!,
        destinationStop: stopRepo.stops.get('STOP_RIT_2')!,
        originSequence: 5,
        destinationSequence: 13,
        stopsBetween: 8,
      },
      {
        route: { routeId: '971', routeShortName: '971', routeLongName: 'Route 971' },
        originStop: stopRepo.stops.get('STOP_BEG_1')!,
        destinationStop: stopRepo.stops.get('STOP_RIT_1')!,
        originSequence: 2,
        destinationSequence: 12,
        stopsBetween: 10,
      },
      {
        route: { routeId: '990', routeShortName: '990', routeLongName: 'Route 990' },
        originStop: stopRepo.stops.get('STOP_BEG_2')!,
        destinationStop: stopRepo.stops.get('STOP_RIT_1')!,
        originSequence: 4,
        destinationSequence: 15,
        stopsBetween: 11,
      },
    ];

    // User searches between STOP_BEG_1 and STOP_RIT_1
    // Even though 102A and 990 touch other stops in the cluster, all 3 routes connecting the clusters must be matched!
    const journeys = await routeService.findJourneys('STOP_BEG_1', 'STOP_RIT_1', 1000);

    assert.equal(journeys.length, 3);
    const matchedRouteIds = journeys.map((j) => j.route.routeId);
    assert.ok(matchedRouteIds.includes('102A'));
    assert.ok(matchedRouteIds.includes('971'));
    assert.ok(matchedRouteIds.includes('990'));
  });
});
