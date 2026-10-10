import { createLogger, SystemClock, type IClock } from '@ecotransit/core-utils';
import type { ISocketGateway, TelemetryBatchFrame, VehiclePosition } from '@ecotransit/contracts';
import type { ILivePositionRepository, LivePosition } from '../repositories/contracts.js';

const logger = createLogger('api-gateway:broadcast-scheduler');

export class BroadcastScheduler {
  private timer: NodeJS.Timeout | null = null;
  private previousPositionsMap = new Map<string, LivePosition>();
  private tickCount = 0;
  private readonly FULL_FRAME_INTERVAL_TICKS = 12; // Every ~60s if tick is 5s

  constructor(
    private readonly livePosRepo: ILivePositionRepository,
    private readonly gateway: ISocketGateway,
    private readonly intervalMs = 5000,
    private readonly clock: IClock = new SystemClock(),
  ) {}

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, 'Starting telemetry broadcast scheduler');
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error({ err }, 'Error during broadcast scheduler tick');
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped telemetry broadcast scheduler');
    }
  }

  async tick(): Promise<void> {
    if (this.gateway.connectionCount() === 0) {
      return;
    }

    try {
      const currentPositions = await this.livePosRepo.findAllLive();
      this.tickCount++;

      const isFullFrame =
        this.tickCount === 1 || this.tickCount % this.FULL_FRAME_INTERVAL_TICKS === 0;

      const currentMap = new Map<string, LivePosition>();
      for (const pos of currentPositions) {
        currentMap.set(pos.vehicleId, pos);
      }

      let frameVehicles: VehiclePosition[] = [];
      let frameType: 'full' | 'delta' = 'full';

      if (isFullFrame) {
        frameType = 'full';
        frameVehicles = currentPositions;
      } else {
        frameType = 'delta';
        // Compute delta: include vehicles that are new or changed
        for (const pos of currentPositions) {
          const prev = this.previousPositionsMap.get(pos.vehicleId);
          if (!prev || this.hasPositionChanged(prev, pos)) {
            frameVehicles.push(pos);
          }
        }
      }

      this.previousPositionsMap = currentMap;

      if (frameVehicles.length > 0 || isFullFrame) {
        const frame: TelemetryBatchFrame = {
          timestamp: this.clock.epochSeconds(),
          frameType,
          vehicles: frameVehicles,
        };

        this.gateway.broadcast(frame);
        logger.debug(
          { frameType, count: frameVehicles.length, tick: this.tickCount },
          'Broadcasted telemetry frame',
        );
      }
    } catch (cause) {
      logger.error({ cause }, 'Failed to fetch or broadcast live position frame');
    }
  }

  private hasPositionChanged(prev: LivePosition, curr: LivePosition): boolean {
    return (
      prev.latitude !== curr.latitude ||
      prev.longitude !== curr.longitude ||
      prev.speed !== curr.speed ||
      prev.bearing !== curr.bearing ||
      prev.routeId !== curr.routeId
    );
  }
}
