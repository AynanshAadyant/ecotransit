import { create } from 'zustand';
import { IncidentDraft, submitIncidentReport } from '../api/incident.api';
import { IncidentSeverity } from '@ecotransit/contracts';

const DRAFT_STORAGE_KEY = 'ecotransit_staff_incident_draft';

function loadPersistedDraft(): IncidentDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistDraft(draft: IncidentDraft | null) {
  try {
    if (draft) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[Staff Storage] Could not persist draft:', err);
  }
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface StaffIncidentState {
  activeDraft: IncidentDraft | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastSubmittedId: string | null;
  saveDraft: (data: { vehicleId?: string; routeId?: string; severity: IncidentSeverity; description: string }) => IncidentDraft;
  submitDraft: () => Promise<boolean>;
  clearDraft: () => void;
  initDraft: () => void;
}

export const useStaffIncidentStore = create<StaffIncidentState>((set, get) => ({
  activeDraft: loadPersistedDraft(),
  isSubmitting: false,
  submissionError: null,
  lastSubmittedId: null,

  initDraft: () => {
    const existing = loadPersistedDraft();
    if (existing) {
      set({ activeDraft: existing });
    }
  },

  /**
   * Spec §4.2:
   * 1. Generates an idempotency key client-side.
   * 2. Saves form as a local draft BEFORE attempting network call.
   */
  saveDraft: (data) => {
    const existing = get().activeDraft;
    const draft: IncidentDraft = {
      idempotencyKey: existing?.idempotencyKey || generateUUID(),
      vehicleId: data.vehicleId,
      routeId: data.routeId,
      severity: data.severity,
      description: data.description,
      createdAt: existing?.createdAt || Date.now(),
    };

    persistDraft(draft);
    set({ activeDraft: draft, submissionError: null });
    return draft;
  },

  /**
   * Spec §4.2:
   * 3. Attempt API call with idempotency key attached.
   * 4. On success: remove local draft.
   * 5. On failure: keep draft and allow retry.
   */
  submitDraft: async () => {
    const draft = get().activeDraft;
    if (!draft) return false;

    set({ isSubmitting: true, submissionError: null });

    try {
      const result = await submitIncidentReport(draft);

      // On success: remove draft from local storage & memory
      persistDraft(null);
      set({
        activeDraft: null,
        isSubmitting: false,
        lastSubmittedId: result.incidentId,
        submissionError: null,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network failure. Draft retained for retry.';
      // On failure: keep draft and retry flag active
      set({
        isSubmitting: false,
        submissionError: message,
      });
      return false;
    }
  },

  clearDraft: () => {
    persistDraft(null);
    set({ activeDraft: null, submissionError: null });
  },
}));
