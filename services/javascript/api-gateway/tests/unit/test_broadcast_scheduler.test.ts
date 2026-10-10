import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SystemClock } from '@ecotransit/core-utils';
import {
  MockLivePositionRepository,
  MockSocketGateway,
} from '../fixtures/mock-repositories.js';
import { BroadcastScheduler } from '../../src/realtime/broadcast.scheduler.js';

describe('Unit Tests: BroadcastScheduler Delta Engine', () => {
  let livePosRepo: MockLivePositionRepository;
  let socketGateway: MockSocketGateway;
  let scheduler: BroadcastScheduler;
  let clock: SystemClock;

  beforeEach(() => {
    livePosRepo = new MockLivePositionRepository();
    socketGateway = new MockSocketGateway();
    clock = new SystemClock();
    scheduler = new BroadcastScheduler(livePosRepo, socketGateway, 1000, clock);
  });

  it('should bypass broadcast when zero socket clients are connected', async () => {
    socketGateway.clientCount = 0;
    livePosRepo.positions.set('BUS_1', {
      vehicleId: 'BUS_1',
      routeId: '100',
      latitude: 28.6,
      longitude: 77.2,
      timestamp: 1000,
      updatedAt: 1000,
    });

    await scheduler.tick();
    assert.equal(socketGateway.broadcastedFrames.length, 0);
  });

  it('should emit full frame on initial tick when clients are connected', async () => {
    socketGateway.clientCount = 2;
    livePosRepo.positions.set('BUS_1', {
      vehicleId: 'BUS_1',
      routeId: '100',
      latitude: 28.6,
      longitude: 77.2,
      timestamp: 1000,
      updatedAt: 1000,
    });

    await scheduler.tick();

    assert.equal(socketGateway.broadcastedFrames.length, 1);
    const frame = socketGateway.broadcastedFrames[0]!;
    assert.equal(frame.frameType, 'full');
    assert.equal(frame.vehicles.length, 1);
    assert.equal(frame.vehicles[0]?.vehicleId, 'BUS_1');
  });

  it('should emit delta frame on second tick containing only moved/changed vehicles', async () => {
    socketGateway.clientCount = 2;

    // Tick 1: Full frame with BUS_1 and BUS_2
    livePosRepo.positions.set('BUS_1', {
      vehicleId: 'BUS_1',
      routeId: '100',
      latitude: 28.6,
      longitude: 77.2,
      speed: 10,
      timestamp: 1000,
      updatedAt: 1000,
    });
    livePosRepo.positions.set('BUS_2', {
      vehicleId: 'BUS_2',
      routeId: '100',
      latitude: 28.7,
      longitude: 77.3,
      speed: 12,
      timestamp: 1000,
      updatedAt: 1000,
    });

    await scheduler.tick();
    assert.equal(socketGateway.broadcastedFrames[0]?.frameType, 'full');

    // Tick 2: Only BUS_1 moves, BUS_2 stays stationary
    livePosRepo.positions.set('BUS_1', {
      vehicleId: 'BUS_1',
      routeId: '100',
      latitude: 28.601, // moved lat
      longitude: 77.2,
      speed: 15,
      timestamp: 1005,
      updatedAt: 1005,
    });

    await scheduler.tick();

    assert.equal(socketGateway.broadcastedFrames.length, 2);
    const deltaFrame = socketGateway.broadcastedFrames[1]!;
    assert.equal(deltaFrame.frameType, 'delta');
    assert.equal(deltaFrame.vehicles.length, 1);
    assert.equal(deltaFrame.vehicles[0]?.vehicleId, 'BUS_1');
  });

  it('should handle Redis repository exception gracefully during tick without crashing scheduler', async () => {
    socketGateway.clientCount = 1;
    livePosRepo.shouldFail = true;

    // Must not throw an unhandled rejection
    await scheduler.tick();
    assert.equal(socketGateway.broadcastedFrames.length, 0);
  });
});
