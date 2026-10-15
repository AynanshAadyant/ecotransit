import { NotFoundError, ValidationError, type IClock } from '@ecotransit/core-utils';
import type { GetVehicleEtaQuery, EtaResult } from '@ecotransit/contracts';
import type {
  ILivePositionRepository,
  IStopRepository,
  IRouteSegmentRepository,
  ITraversalMatrixRepository,
} from '../repositories/contracts.js';
import type { IEtaService } from './contracts.js';

export class EtaService implements IEtaService {
  constructor(
    private readonly livePosRepo: ILivePositionRepository,
    private readonly stopRepo: IStopRepository,
    private readonly segmentRepo: IRouteSegmentRepository,
    private readonly matrixRepo: ITraversalMatrixRepository,
    private readonly clock: IClock,
  ) {}

  async getEtaForVehicle(q: GetVehicleEtaQuery): Promise<EtaResult> {
    // 1. Check if vehicle is live
    const position = await this.livePosRepo.find(q.vehicleId);
    if (!position) {
      throw new NotFoundError('Live vehicle', q.vehicleId);
    }

    if (!position.routeId) {
      throw new ValidationError(`Vehicle '${q.vehicleId}' has no active route assigned`);
    }

    // 2. Resolve vehicle's current nearest stop sequence on route (using bearing if available)
    const nearest = await this.stopRepo.findNearestOnRoute(
      position.routeId,
      position.latitude,
      position.longitude,
      position.bearing,
    );

    // 3. Find remaining segments from vehicle sequence to target stop
    const remainingSegments = await this.segmentRepo.findRemaining(
      position.routeId,
      nearest.stopSequence,
      q.targetStopId,
    );

    if (!remainingSegments || remainingSegments.length === 0) {
      throw new ValidationError(
        `Target stop '${q.targetStopId}' is not downstream of vehicle '${q.vehicleId}' current sequence ${nearest.stopSequence}`,
      );
    }

    // 4. Get current time bucket in Asia/Kolkata timezone
    const bucket = this.clock.bucket();

    // 5. Calculate range-sum ETA over traversal matrix
    const segmentIds = remainingSegments.map((s) => s.segmentId);
    return this.matrixRepo.sumTraversal(segmentIds, bucket);
  }
}
