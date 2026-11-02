import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVehiclesStore } from '../state/vehicles.store';

vi.mock('../api/vehicles.api', () => ({
  fetchVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
}));

import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle } from '../api/vehicles.api';

const mockFetch = fetchVehicles as ReturnType<typeof vi.fn>;
const mockCreate = createVehicle as ReturnType<typeof vi.fn>;
const mockUpdate = updateVehicle as ReturnType<typeof vi.fn>;
const mockDelete = deleteVehicle as ReturnType<typeof vi.fn>;

const makeVehicle = (id: number) => ({
  id,
  vehicleNumber: `DL${id}AB1234`,
  registrationNumber: `DL${id}REG`,
  vehicleType: 'Electric Bus',
  capacity: 40,
  status: 'active' as const,
  routeId: null,
  deviceId: null,
});

describe('useVehiclesStore', () => {
  beforeEach(() => {
    useVehiclesStore.setState({ vehicles: [], loading: false, actionLoading: false, error: null });
    vi.clearAllMocks();
  });

  it('fetch loads vehicles', async () => {
    const vehicles = [makeVehicle(1), makeVehicle(2)];
    mockFetch.mockResolvedValueOnce(vehicles);

    await useVehiclesStore.getState().fetch();

    expect(useVehiclesStore.getState().vehicles).toHaveLength(2);
    expect(useVehiclesStore.getState().loading).toBe(false);
  });

  it('fetch sets error on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await useVehiclesStore.getState().fetch();

    expect(useVehiclesStore.getState().error).toBe('Network error');
    expect(useVehiclesStore.getState().vehicles).toHaveLength(0);
  });

  it('add appends a new vehicle', async () => {
    const newVehicle = makeVehicle(5);
    mockCreate.mockResolvedValueOnce(newVehicle);

    const result = await useVehiclesStore.getState().add({
      vehicleNumber: 'DL5AB1234',
      registrationNumber: 'DL5REG',
      vehicleType: 'Electric Bus',
      capacity: 40,
      status: 'active',
      routeId: null,
      deviceId: null,
    });

    expect(result.id).toBe(5);
    expect(useVehiclesStore.getState().vehicles).toHaveLength(1);
  });

  it('edit updates a vehicle in the list', async () => {
    useVehiclesStore.setState({ vehicles: [makeVehicle(1)] });
    const updated = { ...makeVehicle(1), status: 'maintenance' as const };
    mockUpdate.mockResolvedValueOnce(updated);

    await useVehiclesStore.getState().edit(1, { status: 'maintenance' });

    expect(useVehiclesStore.getState().vehicles[0].status).toBe('maintenance');
  });

  it('remove deletes a vehicle from the list', async () => {
    useVehiclesStore.setState({ vehicles: [makeVehicle(1), makeVehicle(2)] });
    mockDelete.mockResolvedValueOnce(undefined);

    await useVehiclesStore.getState().remove(1);

    expect(useVehiclesStore.getState().vehicles).toHaveLength(1);
    expect(useVehiclesStore.getState().vehicles[0].id).toBe(2);
  });
});
