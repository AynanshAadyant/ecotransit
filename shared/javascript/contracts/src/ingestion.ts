import type { HealthStatus } from './common.js';

export interface RawPayload {
  source: string;
  timestamp: number;
  payload: unknown;
  metadata?: Record<string, unknown> | undefined;
}

export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  tripId?: string | undefined;
  latitude: number;
  longitude: number;
  bearing?: number | undefined;
  speed?: number | undefined; // in m/s
  timestamp: number; // GPS epoch seconds
  nearestStopSequence?: number | undefined;
  isSpeedSuspect?: boolean | undefined;
  raw?: unknown | undefined;
}

export interface RuleOutcome {
  passed: boolean;
  code: string;
  reason?: string | undefined;
}

export interface ValidationContext {
  previousPosition?: VehiclePosition | undefined;
  receivedAt: number;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  failedRule?: string | undefined;
  failureReason?: string | undefined;
}

export interface SinkError {
  vehicleId?: string | undefined;
  error: string;
}

export interface SinkResult {
  writtenCount: number;
  errors?: SinkError[] | undefined;
}

export interface ISource {
  readonly name: string;
  open(): Promise<void>;
  stream(): AsyncIterable<RawPayload>;
  close(): Promise<void>;
}

export interface IParser {
  supports(payload: RawPayload): boolean;
  parse(payload: RawPayload): VehiclePosition[];
}

export interface IValidationRule {
  readonly code: string;
  check(position: VehiclePosition, context: ValidationContext): RuleOutcome;
}

export interface ISink {
  readonly isCritical: boolean;
  write(batch: VehiclePosition[]): Promise<SinkResult>;
  health(): Promise<HealthStatus>;
}
