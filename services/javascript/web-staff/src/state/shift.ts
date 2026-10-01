import { create } from 'zustand';
import { Shift } from '@ecotransit/contracts';

export interface ShiftState {
  currentShift: Shift | null;
  loading: boolean;
  confirming: boolean;
  fallbackPositionActive: boolean;
  error: string | null;
  setCurrentShift: (shift: Shift | null) => void;
  setLoading: (loading: boolean) => void;
  setConfirming: (confirming: boolean) => void;
  setFallbackPositionActive: (active: boolean) => void;
  setError: (error: string | null) => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  currentShift: null,
  loading: false,
  confirming: false,
  fallbackPositionActive: false,
  error: null,
  setCurrentShift: (currentShift) => set({ currentShift, loading: false }),
  setLoading: (loading) => set({ loading }),
  setConfirming: (confirming) => set({ confirming }),
  setFallbackPositionActive: (fallbackPositionActive) => set({ fallbackPositionActive }),
  setError: (error) => set({ error, loading: false, confirming: false }),
}));
