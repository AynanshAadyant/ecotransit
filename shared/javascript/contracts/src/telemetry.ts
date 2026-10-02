import type { VehiclePosition } from './ingestion.js';

export interface TelemetryBatchFrame {
  timestamp: number;
  frameType: 'full' | 'delta';
  vehicles: VehiclePosition[];
}

export interface ISocketGateway {
  broadcast(frame: TelemetryBatchFrame): void;
  connectionCount(): number;
}
