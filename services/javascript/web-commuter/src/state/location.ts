import { create } from 'zustand';

export interface SelectedLocation {
  name: string;
  latitude: number;
  longitude: number;
  displayName?: string;
}

interface LocationState {
  selectedLocation: SelectedLocation | null;
  setSelectedLocation: (location: SelectedLocation) => void;
  clearSelectedLocation: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  selectedLocation: null,
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  clearSelectedLocation: () => set({ selectedLocation: null }),
}));
