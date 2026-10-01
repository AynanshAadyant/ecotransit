import { create } from 'zustand';
import { JourneyResult } from '@ecotransit/contracts';

/**
 * Spec §2.2:
 * search state: { origin: string | null; destination: string | null; results: JourneyResult[]; loading: boolean }
 */
export interface SearchState {
  origin: string | null;
  destination: string | null;
  results: JourneyResult[];
  loading: boolean;
  error: string | null;
  setOrigin: (origin: string | null) => void;
  setDestination: (destination: string | null) => void;
  setResults: (results: JourneyResult[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  origin: null,
  destination: null,
  results: [],
  loading: false,
  error: null,
  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setResults: (results) => set({ results, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  resetSearch: () => set({ origin: null, destination: null, results: [], loading: false, error: null }),
}));
