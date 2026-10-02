import type { StaffRole } from './common.js';

export interface StaffClaims {
  staffId: string;
  role: StaffRole;
  sessionId: string;
}

export interface StaffRecord {
  staffId: string;
  employeeId: string;
  name: string;
  role: StaffRole;
  credentialHash: string;
  isActive: boolean;
  createdAt?: number | undefined;
  updatedAt?: number | undefined;
}

export interface StaffSession {
  id: string;
  staffId: string;
  role: StaffRole;
  createdAt: number;
  expiresAt: number;
  vehicleId?: string | undefined;
}

export interface ShiftAssignment {
  id: string;
  staffId: string;
  vehicleId: string;
  routeId: string;
  startTime: number;
  endTime?: number | undefined;
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: number | undefined;
}

export interface LoginCommand {
  employeeId: string;
  password: string;
}

export interface BindShiftCommand {
  sessionId: string;
  staffId: string;
  vehicleId: string;
  routeId: string;
}

export interface AuthenticatedSession {
  session: StaffSession;
  token: string;
}

export interface ITokenIssuer {
  issue(claims: StaffClaims, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<StaffClaims>;
}

export interface IPasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export interface ISessionStore {
  put(sessionId: string, session: StaffSession, ttlSeconds: number): Promise<void>;
  get(sessionId: string): Promise<StaffSession | null>;
  revoke(sessionId: string): Promise<void>;
  attachVehicle?(sessionId: string, vehicleId: string): Promise<void>;
}

export interface IStaffRepository {
  findByEmployeeId(employeeId: string): Promise<StaffRecord | null>;
  findById(staffId: string): Promise<StaffRecord | null>;
  create(staff: Omit<StaffRecord, 'staffId'>): Promise<StaffRecord>;
}

export interface IShiftAssignmentRepository {
  findActiveConflict(
    staffId: string,
    vehicleId: string,
    txClient?: unknown,
  ): Promise<ShiftAssignment | null>;
  insert(assignment: ShiftAssignment, txClient?: unknown): Promise<void>;
  withTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}
