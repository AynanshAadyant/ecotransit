import React, { useState, useEffect } from 'react';
import { IncidentSeverity } from '@ecotransit/contracts';
import { Button } from '@ecotransit/ui';
import { IncidentDraft } from '../api/incident.api';

interface IncidentFormProps {
  initialDraft: IncidentDraft | null;
  defaultVehicleId?: string;
  defaultRouteId?: string;
  isSubmitting: boolean;
  submissionError: string | null;
  lastSubmittedId: string | null;
  onSaveDraft: (data: { vehicleId?: string; routeId?: string; severity: IncidentSeverity; description: string }) => void;
  onSubmit: () => void;
  onClearDraft: () => void;
}

export const IncidentForm: React.FC<IncidentFormProps> = ({
  initialDraft,
  defaultVehicleId = '',
  defaultRouteId = '',
  isSubmitting,
  submissionError,
  lastSubmittedId,
  onSaveDraft,
  onSubmit,
  onClearDraft,
}) => {
  const [vehicleId, setVehicleId] = useState(initialDraft?.vehicleId || defaultVehicleId);
  const [routeId, setRouteId] = useState(initialDraft?.routeId || defaultRouteId);
  const [severity, setSeverity] = useState<IncidentSeverity>(initialDraft?.severity || 'MEDIUM');
  const [description, setDescription] = useState(initialDraft?.description || '');

  // Keep local draft updated on input changes
  useEffect(() => {
    if (description.trim()) {
      onSaveDraft({ vehicleId, routeId, severity, description });
    }
  }, [vehicleId, routeId, severity, description, onSaveDraft]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onSaveDraft({ vehicleId, routeId, severity, description });
    onSubmit();
  };

  const handleReset = () => {
    setDescription('');
    onClearDraft();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        padding: '20px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
            Operations Safety
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700 }}>
            Report Field Incident
          </h2>
        </div>

        {initialDraft && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Draft Saved
          </span>
        )}
      </div>

      {lastSubmittedId && !submissionError && (
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
          &check; Incident #{lastSubmittedId} dispatched and acknowledged by Command Center.
        </div>
      )}

      {/* Spec §4.2: Draft-persist on failure with retry */}
      {submissionError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontWeight: 600 }}>Offline or Gateway Failure:</div>
          <div>{submissionError}</div>
          <div style={{ fontSize: '11px', color: '#f87171' }}>
            Draft remains safely stored on this device. Click below to retry transmission.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Vehicle ID
          </label>
          <input
            type="text"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            placeholder="e.g. BUS-402"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Route ID
          </label>
          <input
            type="text"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            placeholder="e.g. LINE-10"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
          Severity Level
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSeverity(lvl)}
              style={{
                padding: '8px 4px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: severity === lvl ? (lvl === 'CRITICAL' || lvl === 'HIGH' ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.1)',
                background: severity === lvl ? (lvl === 'CRITICAL' || lvl === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)') : 'transparent',
                color: severity === lvl ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
          Incident Description & Location Details
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe obstacle, mechanical fault, passenger assistance, or road blockage..."
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f8fafc',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'vertical',
          }}
        />
      </div>

      {initialDraft?.idempotencyKey && (
        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
          Idempotency Key: {initialDraft.idempotencyKey.slice(0, 18)}...
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        {initialDraft && (
          <Button type="button" variant="ghost" onClick={handleReset}>
            Discard Draft
          </Button>
        )}
        <Button
          type="submit"
          variant={severity === 'CRITICAL' ? 'danger' : 'primary'}
          size="lg"
          isLoading={isSubmitting}
          style={{ flex: 1 }}
        >
          {isSubmitting ? 'Transmitting with Key...' : submissionError ? 'Retry Submission' : 'Submit Incident'}
        </Button>
      </div>
    </form>
  );
};
