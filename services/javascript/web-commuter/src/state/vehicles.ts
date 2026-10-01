import { create } from 'zustand';
import { Vehicle } from '@ecotransit/contracts';

/**
 * Spec §2.2 / §10.2:
 * vehicles state: { vehicles: Record<string, Vehicle>; lastFrame: number; connectionStatus: 'connected' | 'disconnected' | 'reconnecting' }
 * Subscribed to via selectors. Never shares state owner with viewport transform.
 */
export interface VehiclesState {
  vehicles: Record<string, Vehicle>;
  lastFrame: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  updateVehicles: (newVehicles: Record<string, Vehicle>, timestamp?: number) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: {},
  lastFrame: 0,
  connectionStatus: 'disconnected',
  updateVehicles: (newVehicles, timestamp = Date.now()) =>
    set((state) => ({
      vehicles: {
        ...state.vehicles,
        ...newVehicles,
      },
      lastFrame: timestamp,
    })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
