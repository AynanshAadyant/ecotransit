import { create } from 'zustand';
import { Incident, IncidentStatus } from '@ecotransit/contracts';

/**
 * Spec §3.3 / §9 / §10.3:
 * Lifecycle is a guarded state machine: OPEN -> ACKNOWLEDGED -> RESOLVED.
 * Invalid transitions are rejected server-side (domain layer).
 * The frontend only exposes actions that correspond to valid transitions
 * from the incident's current state.
 */

export function canTransition(current: IncidentStatus, next: IncidentStatus): boolean {
  if (current === 'OPEN' && next === 'ACKNOWLEDGED') return true;
  if (current === 'ACKNOWLEDGED' && next === 'RESOLVED') return true;
  return false;
}

export interface IncidentState {
  incidents: Incident[];
  selectedIncidentId: string | null;
  filterStatus: IncidentStatus | 'ALL';
  setIncidents: (incidents: Incident[]) => void;
  setSelectedIncidentId: (id: string | null) => void;
  setFilterStatus: (filter: IncidentStatus | 'ALL') => void;
  applyTransition: (incidentId: string, nextStatus: IncidentStatus, notes?: string) => boolean;
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: [],
  selectedIncidentId: null,
  filterStatus: 'ALL',
  setIncidents: (incidents) => set({ incidents }),
  setSelectedIncidentId: (selectedIncidentId) => set({ selectedIncidentId }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  applyTransition: (incidentId, nextStatus, notes) => {
    const state = get();
    const incident = state.incidents.find((i) => i.incidentId === incidentId);
    if (!incident) return false;

    // Guard check: strictly enforce state machine
    if (!canTransition(incident.status, nextStatus)) {
      console.warn(`[Guarded State Machine Violation] Cannot transition from ${incident.status} to ${nextStatus}`);
      return false;
    }

    const updated = state.incidents.map((i) => {
      if (i.incidentId !== incidentId) return i;
      return {
        ...i,
        status: nextStatus,
        acknowledgedBy: nextStatus === 'ACKNOWLEDGED' ? 'Admin Controller' : i.acknowledgedBy,
        resolvedBy: nextStatus === 'RESOLVED' ? 'Admin Controller' : i.resolvedBy,
        resolutionNotes: notes || i.resolutionNotes,
      };
    });

    set({ incidents: updated });
    return true;
  },
}));
