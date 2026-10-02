export type StaffRole = 'conductor' | 'driver' | 'dispatcher' | 'admin';

export type DayType = 'weekday' | 'saturday' | 'sunday';

export interface TimeBucket {
  hourOfDay: number;
  dayType: DayType;
}

export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthStatus {
  status: HealthState;
  details?: Record<string, unknown> | undefined;
}
