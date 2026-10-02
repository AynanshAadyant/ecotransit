import type { GetVehicleEtaQuery, EtaResult } from './transit.js';
import type { LoginCommand, AuthenticatedSession, BindShiftCommand, ShiftAssignment } from './staff.js';
import type { CreateIncidentCommand, Incident } from './incidents.js';

export interface IEtaService {
  getEtaForVehicle(query: GetVehicleEtaQuery): Promise<EtaResult>;
}

export interface IAuthService {
  login(command: LoginCommand): Promise<AuthenticatedSession>;
  logout(sessionId: string): Promise<void>;
}

export interface IShiftService {
  bind(command: BindShiftCommand): Promise<ShiftAssignment>;
  endShift(assignmentId: string): Promise<void>;
}

export interface IIncidentService {
  reportIncident(staffId: string, command: CreateIncidentCommand): Promise<Incident>;
}
