import { create } from 'zustand';
import {
  fetchStaffDashboard,
  fetchStaffVehicles,
  fetchStaffTrips,
  createStaffTrip,
  updateStaffTrip,
  fetchStaffIncidents,
  createStaffIncident,
  type StaffDashboardData,
  type StaffVehicle,
  type Trip,
  type CreateTripPayload,
  type UpdateTripPayload,
  type StaffIncident,
  type CreateStaffIncidentPayload,
} from '../api/staffPortal.api';

interface StaffPortalState {
  dashboardData: StaffDashboardData | null;
  trips: Trip[];
  activeTrip: Trip | null;
  vehicles: StaffVehicle[];
  incidents: StaffIncident[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  loadDashboard: () => Promise<void>;
  loadTrips: (filters?: { status?: string }) => Promise<void>;
  loadVehicles: () => Promise<void>;
  startTrip: (payload: CreateTripPayload) => Promise<Trip>;
  endTrip: (tripId: number, notes?: string) => Promise<Trip>;
  updateTripStatus: (tripId: number, payload: UpdateTripPayload) => Promise<Trip>;
  loadIncidents: (filters?: { status?: string; severity?: string }) => Promise<void>;
  reportIncident: (payload: CreateStaffIncidentPayload) => Promise<StaffIncident>;
}

export const useStaffPortalStore = create<StaffPortalState>((set, get) => ({
  dashboardData: null,
  trips: [],
  activeTrip: null,
  vehicles: [],
  incidents: [],
  loading: false,
  actionLoading: false,
  error: null,

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchStaffDashboard();
      // Find current active trip for staff
      const active = data.activeTrips.find((t) => t.status === 'active') || null;
      set({ dashboardData: data, activeTrip: active, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load staff dashboard';
      set({ error: message, loading: false });
    }
  },

  loadTrips: async (filters) => {
    set({ loading: true, error: null });
    try {
      const trips = await fetchStaffTrips(filters);
      const active = trips.find((t) => t.status === 'active') || null;
      set({ trips, activeTrip: active ?? get().activeTrip, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load trips';
      set({ error: message, loading: false });
    }
  },

  loadVehicles: async () => {
    try {
      const vehicles = await fetchStaffVehicles();
      set({ vehicles });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load vehicles';
      set({ error: message });
    }
  },

  startTrip: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createStaffTrip(payload);
      set((state) => ({
        trips: [created, ...state.trips],
        activeTrip: created.status === 'active' ? created : state.activeTrip,
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start shift / trip';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  endTrip: async (tripId, notes) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateStaffTrip(tripId, {
        status: 'completed',
        notes: notes || 'Shift completed successfully',
        endTime: new Date().toISOString(),
      });
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? updated : t)),
        activeTrip: state.activeTrip?.id === tripId ? null : state.activeTrip,
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to end shift / trip';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  updateTripStatus: async (tripId, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateStaffTrip(tripId, payload);
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? updated : t)),
        activeTrip:
          payload.status === 'completed' || payload.status === 'cancelled'
            ? state.activeTrip?.id === tripId
              ? null
              : state.activeTrip
            : payload.status === 'active'
            ? updated
            : state.activeTrip,
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update trip';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  loadIncidents: async (filters) => {
    set({ loading: true, error: null });
    try {
      const incidents = await fetchStaffIncidents(filters);
      set({ incidents, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load incidents';
      set({ error: message, loading: false });
    }
  },

  reportIncident: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createStaffIncident(payload);
      set((state) => ({
        incidents: [created, ...state.incidents],
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to report incident';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },
}));
