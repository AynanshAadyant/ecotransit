import { create } from 'zustand';
import {
  fetchStaff,
  deleteStaff,
  type Staff,
} from '../api/staff.api';

interface StaffState {
  staff: Staff[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set) => ({
  staff: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const staff = await fetchStaff();
      set({ staff, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load staff';
      set({ error: message, loading: false });
    }
  },

  remove: async (id) => {
    try {
      await deleteStaff(id);
      set((state) => ({
        staff: state.staff.filter((s) => s.id !== id),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete staff member';
      set({ error: message });
    }
  },
}));
