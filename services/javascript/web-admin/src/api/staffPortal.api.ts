import client from './client';

export interface AssignedVehicle {
  id: number;
  vehicleNumber: string;
  registrationNumber: string;
  status: string;
  routeName?: string;
  routeCode?: string;
}

export interface LiveVehicleStatus {
  id: number;
  vehicleNumber: string;
  routeName?: string;
  dbStatus: string;
  liveStatus: string;
}

export interface Trip {
  id: number;
  vehicleId: number;
  routeId: number;
  staffId: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vehicleNumber?: string;
  registrationNumber?: string;
  routeName?: string;
  routeCode?: string;
  driverName?: string;
  driverEmail?: string;
}

export interface StaffIncidentSummary {
  id: number;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'reported' | 'under_investigation' | 'resolved' | 'dismissed' | string;
  createdAt: string;
  vehicleNumber?: string;
  routeName?: string;
}

export interface StaffActivity {
  type: 'trip' | 'incident' | string;
  id: number;
  summary: string;
  timestamp: string;
}

export interface StaffDashboardData {
  assignedVehicles: AssignedVehicle[];
  activeTrips: Trip[];
  vehicleStatuses: LiveVehicleStatus[];
  openIncidents: StaffIncidentSummary[];
  recentActivity: StaffActivity[];
}

export interface StaffVehicle {
  id: number;
  vehicle_number: string;
  registration_number: string;
  type?: string;
  capacity?: number;
  status: string;
  route_id?: number | null;
  route_name?: string;
}

export interface CreateTripPayload {
  vehicleId: number;
  routeId: number;
  status?: 'scheduled' | 'active';
  startTime?: string;
  notes?: string;
}

export interface UpdateTripPayload {
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes?: string;
  endTime?: string;
}

export interface StaffIncident {
  id: number;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'reported' | 'under_investigation' | 'resolved' | 'dismissed' | string;
  latitude?: number | null;
  longitude?: number | null;
  vehicleId?: number | null;
  routeId?: number | null;
  reportedBy: number;
  reportedByName?: string;
  reportedByEmail?: string;
  vehicleNumber?: string;
  registrationNumber?: string;
  routeName?: string;
  routeCode?: string;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateStaffIncidentPayload {
  type: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  latitude?: number | null;
  longitude?: number | null;
  vehicleId?: number | null;
  routeId?: number | null;
}

export async function fetchStaffDashboard(): Promise<StaffDashboardData> {
  const { data } = await client.get('/staff/dashboard');
  return data.data ?? data;
}

export async function fetchStaffVehicles(): Promise<StaffVehicle[]> {
  const { data } = await client.get('/staff/vehicles');
  return data.data ?? data;
}

export async function fetchStaffVehicleById(id: number): Promise<StaffVehicle> {
  const { data } = await client.get(`/staff/vehicles/${id}`);
  return data.data ?? data;
}

export async function fetchStaffTrips(filters?: { status?: string; staffId?: number }): Promise<Trip[]> {
  const { data } = await client.get('/staff/trips', { params: filters });
  return data.data ?? data;
}

export async function fetchStaffTripById(id: number): Promise<Trip> {
  const { data } = await client.get(`/staff/trips/${id}`);
  return data.data ?? data;
}

export async function createStaffTrip(payload: CreateTripPayload): Promise<Trip> {
  const { data } = await client.post('/staff/trips', payload);
  return data.data ?? data;
}

export async function updateStaffTrip(id: number, payload: UpdateTripPayload): Promise<Trip> {
  const { data } = await client.patch(`/staff/trips/${id}`, payload);
  return data.data ?? data;
}

export async function fetchStaffIncidents(filters?: { status?: string; severity?: string }): Promise<StaffIncident[]> {
  const { data } = await client.get('/staff/incidents', { params: filters });
  return data.data ?? data;
}

export async function fetchStaffIncidentById(id: number): Promise<StaffIncident> {
  const { data } = await client.get(`/staff/incidents/${id}`);
  return data.data ?? data;
}

export async function createStaffIncident(payload: CreateStaffIncidentPayload): Promise<StaffIncident> {
  const { data } = await client.post('/staff/incidents', payload);
  return data.data ?? data;
}
