import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStaffPortalStore } from '../state/staffPortal.store';
import type { Trip } from '../api/staffPortal.api';

vi.mock('../api/staffPortal.api', () => ({
  fetchStaffDashboard: vi.fn(),
  fetchStaffVehicles: vi.fn(),
  fetchStaffTrips: vi.fn(),
  createStaffTrip: vi.fn(),
  updateStaffTrip: vi.fn(),
  fetchStaffIncidents: vi.fn(),
  createStaffIncident: vi.fn(),
}));

import {
  createStaffTrip,
  updateStaffTrip,
  createStaffIncident,
  fetchStaffTrips,
} from '../api/staffPortal.api';

const mockCreateTrip = createStaffTrip as ReturnType<typeof vi.fn>;
const mockUpdateTrip = updateStaffTrip as ReturnType<typeof vi.fn>;
const mockCreateIncident = createStaffIncident as ReturnType<typeof vi.fn>;
const mockFetchTrips = fetchStaffTrips as ReturnType<typeof vi.fn>;

const makeTrip = (id: number, status: 'scheduled' | 'active' | 'completed' | 'cancelled' = 'active'): Trip => ({
  id,
  staffId: 1,
  vehicleId: 10,
  routeId: 2,
  status,
  startTime: new Date().toISOString(),
  endTime: null,
  notes: null,
  createdAt: new Date().toISOString(),
});

describe('useStaffPortalStore', () => {
  beforeEach(() => {
    useStaffPortalStore.setState({
      dashboardData: null,
      trips: [],
      activeTrip: null,
      vehicles: [],
      incidents: [],
      loading: false,
      actionLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('startTrip creates a trip and sets activeTrip', async () => {
    const trip = makeTrip(1);
    mockCreateTrip.mockResolvedValueOnce(trip);

    const result = await useStaffPortalStore.getState().startTrip({
      vehicleId: 10,
      routeId: 2,
    });

    expect(result.id).toBe(1);
    expect(useStaffPortalStore.getState().activeTrip?.id).toBe(1);
    expect(useStaffPortalStore.getState().trips).toHaveLength(1);
  });

  it('endTrip updates the active trip to completed', async () => {
    const active = makeTrip(1, 'active');
    useStaffPortalStore.setState({ trips: [active], activeTrip: active });

    const ended = { ...active, status: 'completed' as const, endTime: new Date().toISOString() };
    mockUpdateTrip.mockResolvedValueOnce(ended);

    await useStaffPortalStore.getState().endTrip(1, 'Completed normally');

    const state = useStaffPortalStore.getState();
    expect(state.activeTrip).toBeNull();
    expect(state.trips[0].status).toBe('completed');
  });

  it('reportIncident creates a new incident', async () => {
    const incident = {
      id: 1,
      staffId: 1,
      type: 'mechanical_failure',
      description: 'Engine stalled',
      severity: 'high',
      status: 'reported',
      latitude: null,
      longitude: null,
      createdAt: new Date().toISOString(),
    };
    mockCreateIncident.mockResolvedValueOnce(incident);

    const result = await useStaffPortalStore.getState().reportIncident({
      type: 'mechanical_failure',
      description: 'Engine stalled',
      severity: 'high',
    });

    expect(result.id).toBe(1);
    expect(useStaffPortalStore.getState().incidents).toHaveLength(1);
  });

  it('loadTrips sets activeTrip from active trips', async () => {
    const trips = [makeTrip(1, 'completed'), makeTrip(2, 'active')];
    mockFetchTrips.mockResolvedValueOnce(trips);

    await useStaffPortalStore.getState().loadTrips();

    expect(useStaffPortalStore.getState().activeTrip?.id).toBe(2);
  });
});
