import { create } from 'zustand';
import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  type Staff,
  type CreateStaffPayload,
} from '../api/staff.api';

interface StaffState {
  staff: Staff[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  add: (payload: CreateStaffPayload) => Promise<Staff>;
  edit: (id: number, payload: Partial<CreateStaffPayload>) => Promise<Staff>;
  remove: (id: number) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set) => ({
  staff: [],
  loading: false,
  actionLoading: false,
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

  add: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const created = await createStaff(payload);
      set((state) => ({
        staff: [...state.staff, created],
        actionLoading: false,
      }));
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create staff account';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  edit: async (id, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateStaff(id, payload);
      set((state) => ({
        staff: state.staff.map((s) => (s.id === id ? { ...s, ...updated } : s)),
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update staff account';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  remove: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await deleteStaff(id);
      set((state) => ({
        staff: state.staff.filter((s) => s.id !== id),
        actionLoading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete staff member';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },
}));
