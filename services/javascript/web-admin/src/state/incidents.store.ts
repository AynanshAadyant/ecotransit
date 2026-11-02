import { create } from 'zustand';
import {
  fetchIncidents,
  updateIncident,
  type Incident,
  type UpdateIncidentPayload,
} from '../api/incidents.api';

interface IncidentsState {
  incidents: Incident[];
  selectedIncident: Incident | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  fetch: (filters?: { status?: string; severity?: string }) => Promise<void>;
  selectIncident: (incident: Incident | null) => void;
  updateStatus: (id: number, payload: UpdateIncidentPayload) => Promise<Incident>;
  assignToStaff: (id: number, staffName: string, staffId: number, notes?: string) => Promise<Incident>;
  resolveIncident: (id: number, resolutionNotes: string) => Promise<Incident>;
}

export const useIncidentsStore = create<IncidentsState>((set, get) => ({
  incidents: [],
  selectedIncident: null,
  loading: false,
  actionLoading: false,
  error: null,

  fetch: async (filters) => {
    set({ loading: true, error: null });
    try {
      const incidents = await fetchIncidents(filters);
      set({ incidents, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load incidents';
      set({ error: message, loading: false });
    }
  },

  selectIncident: (incident) => {
    set({ selectedIncident: incident });
  },

  updateStatus: async (id, payload) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await updateIncident(id, payload);
      set((state) => ({
        incidents: state.incidents.map((i) => (i.id === id ? { ...i, ...updated } : i)),
        selectedIncident: state.selectedIncident?.id === id ? { ...state.selectedIncident, ...updated } : state.selectedIncident,
        actionLoading: false,
      }));
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update incident';
      set({ error: message, actionLoading: false });
      throw err;
    }
  },

  assignToStaff: async (id, staffName, staffId, notes) => {
    const noteText = `[Assigned to: ${staffName} (ID #${staffId})] ${notes || 'Assigned for immediate on-site investigation.'}`;
    return get().updateStatus(id, {
      status: 'under_investigation',
      adminNotes: noteText,
    });
  },

  resolveIncident: async (id, resolutionNotes) => {
    const noteText = `[RESOLVED] ${resolutionNotes || 'Disruption cleared and confirmed by dispatch.'}`;
    return get().updateStatus(id, {
      status: 'resolved',
      adminNotes: noteText,
    });
  },
}));
