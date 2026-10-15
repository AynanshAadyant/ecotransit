import React, { useEffect } from 'react';
import { useStaffIncidentStore } from '../state/incident';
import { useShiftStore } from '../state/shift';
import { IncidentForm } from '../components/IncidentForm';

export const Incident: React.FC = () => {
  const {
    activeDraft,
    isSubmitting,
    submissionError,
    lastSubmittedId,
    saveDraft,
    submitDraft,
    clearDraft,
    initDraft,
  } = useStaffIncidentStore();

  const currentShift = useShiftStore((s) => s.currentShift);

  useEffect(() => {
    initDraft();
  }, [initDraft]);

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <IncidentForm
        initialDraft={activeDraft}
        defaultVehicleId={currentShift?.assignedVehicleId || ''}
        defaultRouteId={currentShift?.assignedRouteId || ''}
        isSubmitting={isSubmitting}
        submissionError={submissionError}
        lastSubmittedId={lastSubmittedId}
        onSaveDraft={saveDraft}
        onSubmit={submitDraft}
        onClearDraft={clearDraft}
      />
    </div>
  );
};
