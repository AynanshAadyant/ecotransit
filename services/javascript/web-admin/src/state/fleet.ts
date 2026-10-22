import { create } from 'zustand';
import { Vehicle } from '@ecotransit/contracts';
import { RouteHealth } from '../api/fleet.api';

export interface FleetState {
  vehicles: Record<string, Vehicle>;
  routesHealth: RouteHealth[];
  selectedVehicleId: string | null;
  selectedRouteId: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  setVehicles: (vehicles: Record<string, Vehicle>) => void;
  setRoutesHealth: (routesHealth: RouteHealth[]) => void;
  setSelectedVehicleId: (id: string | null) => void;
  setSelectedRouteId: (id: string | null) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  vehicles: {},
  routesHealth: [],
  selectedVehicleId: null,
  selectedRouteId: null,
  connectionStatus: 'disconnected',
  setVehicles: (vehicles) => set({ vehicles }),
  setRoutesHealth: (routesHealth) => set({ routesHealth }),
  setSelectedVehicleId: (selectedVehicleId) => set({ selectedVehicleId }),
  setSelectedRouteId: (selectedRouteId) => set({ selectedRouteId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
