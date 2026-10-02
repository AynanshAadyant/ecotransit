export type IncidentType =
  | 'breakdown'
  | 'accident'
  | 'route_obstruction'
  | 'medical'
  | 'other';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export interface Incident {
  id: string;
  incidentType: IncidentType;
  description: string;
  reportedByStaffId: string;
  vehicleId: string;
  routeId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  status: IncidentStatus;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
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
