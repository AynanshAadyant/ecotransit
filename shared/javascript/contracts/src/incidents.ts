export type IncidentType =
  | 'breakdown'
  | 'accident'
  | 'route_obstruction'
  | 'medical'
  | 'other';

export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'RESOLVED';

export type IncidentSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface Incident {
  incidentId: string;
  id?: string | undefined;
  incidentType?: IncidentType | undefined;
  description: string;
  reportedBy?: string | undefined;
  reportedByStaffId?: string | undefined;
  vehicleId?: string | undefined;
  routeId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  status: IncidentStatus;
  severity?: IncidentSeverity | undefined;
  idempotencyKey?: string | undefined;
  createdAt?: number | undefined;
  updatedAt?: number | undefined;
  timestamp?: number | string | undefined;
  acknowledgedBy?: string | undefined;
  resolvedBy?: string | undefined;
  resolutionNotes?: string | undefined;
}

export interface CreateIncidentCommand {
  incidentType: IncidentType;
  description: string;
  vehicleId: string;
  routeId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  idempotencyKey: string;
}

export interface IIncidentRepository {
  create(incident: Incident): Promise<Incident>;
  findById(id: string): Promise<Incident | null>;
  findByIdempotencyKey(key: string): Promise<Incident | null>;
  listOpen(): Promise<Incident[]>;
  updateStatus(id: string, status: IncidentStatus): Promise<Incident>;
}
