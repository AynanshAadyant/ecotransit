import type { VehiclePosition } from './ingestion.js';
import type { Vehicle } from './transit.js';

export interface TelemetryBatchFrame {
  timestamp: number;
  frameType: 'full' | 'delta';
  vehicles: VehiclePosition[];
}

export interface TelemetryFrame {
  timestamp?: number | undefined;
  vehicles: Vehicle[];
}

export interface ISocketGateway {
  broadcast(frame: TelemetryBatchFrame): void;
  connectionCount(): number;
}

