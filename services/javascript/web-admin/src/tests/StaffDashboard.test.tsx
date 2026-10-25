import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StaffDashboard from '../pages/staff/StaffDashboard';
import { useStaffPortalStore } from '../state/staffPortal.store';
import { useAuthStore } from '../state/auth.store';
import type { StaffDashboardData } from '../api/staffPortal.api';

const mockDashboardData: StaffDashboardData = {
  assignedVehicles: [],
  activeTrips: [],
  vehicleStatuses: [],
  openIncidents: [],
  recentActivity: [],
};

vi.mock('../../api/staffPortal.api', () => ({
  fetchStaffDashboard: vi.fn().mockResolvedValue(mockDashboardData),
  fetchStaffVehicles: vi.fn().mockResolvedValue([]),
  fetchStaffTrips: vi.fn().mockResolvedValue([]),
  createStaffTrip: vi.fn(),
  updateStaffTrip: vi.fn(),
  fetchStaffIncidents: vi.fn().mockResolvedValue([]),
  createStaffIncident: vi.fn(),
}));

describe('StaffDashboard page', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, name: 'Test Driver', email: 'driver@test.com', role: 'STAFF', status: 'active' },
      isAuthenticated: true,
      token: 'valid-token',
    });

    useStaffPortalStore.setState({
      dashboardData: mockDashboardData,
      trips: [],
      activeTrip: null,
      vehicles: [],
      incidents: [],
      loading: false,
      actionLoading: false,
      error: null,
    });
  });

  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <StaffDashboard />
      </MemoryRouter>
    );

  it('renders driver greeting with name', () => {
    renderDashboard();
    expect(screen.getByText(/Hello,\s*Test Driver/i)).toBeTruthy();
  });

  it('renders operator station badge', () => {
    renderDashboard();
    expect(screen.getByText(/Operator Station/i)).toBeTruthy();
  });

  it('renders start shift action button', () => {
    renderDashboard();
    expect(screen.getByRole('link', { name: /start shift/i })).toBeTruthy();
  });

  it('renders report incident action button', () => {
    renderDashboard();
    expect(screen.getByRole('link', { name: /report incident/i })).toBeTruthy();
  });

  it('renders current shift status card', () => {
    renderDashboard();
    expect(screen.getByText(/Current Shift Status/i)).toBeTruthy();
    expect(screen.getByText(/Off Shift/i)).toBeTruthy();
  });
});
