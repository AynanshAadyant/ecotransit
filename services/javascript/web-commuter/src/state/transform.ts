import { create } from 'zustand';

/**
 * Spec §2.2 / §10.2:
 * transform state: { zoom: number; panX: number; panY: number }
 * Owned by MapCanvas ONLY.
 * Never shared with live vehicle data.
 */
export interface TransformState {
  zoom: number;
  panX: number;
  panY: number;
  setTransform: (transform: { zoom: number; panX: number; panY: number }) => void;
  setPan: (panX: number, panY: number) => void;
  setZoom: (zoom: number) => void;
  resetTransform: () => void;
}

export const useTransformStore = create<TransformState>((set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  setTransform: (transform) => set(transform),
  setPan: (panX, panY) => set({ panX, panY }),
  setZoom: (zoom) => set({ zoom }),
  resetTransform: () => set({ zoom: 1, panX: 0, panY: 0 }),
}));
