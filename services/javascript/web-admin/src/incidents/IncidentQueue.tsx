import React, { useState } from 'react';
import { Incident, IncidentStatus } from '@ecotransit/contracts';
import { Badge, Button } from '@ecotransit/ui';
import { canTransition } from '../state/incidents';

interface IncidentQueueProps {
  incidents: Incident[];
  onTransition: (incidentId: string, nextStatus: IncidentStatus, notes?: string) => void;
  onSelectIncident: (incident: Incident) => void;
  selectedIncidentId: string | null;
}

export const IncidentQueue: React.FC<IncidentQueueProps> = ({
  incidents,
  onTransition,
  onSelectIncident,
  selectedIncidentId,
}) => {
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const filteredIncidents =
    filter === 'ALL' ? incidents : incidents.filter((i) => i.status === filter);

  const handleResolveSubmit = (incidentId: string) => {
    onTransition(incidentId, 'RESOLVED', resolutionNote);
    setResolvingId(null);
    setResolutionNote('');
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Incident Queue (Guarded Lifecycle)
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Spec §3.3: OPEN &rarr; ACKNOWLEDGED &rarr; RESOLVED
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                background: filter === status ? '#10b981' : 'rgba(255, 255, 255, 0.06)',
                color: filter === status ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredIncidents.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No incidents found in this category.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredIncidents.map((incident) => {
              const isSelected = selectedIncidentId === incident.incidentId;
              const isResolvingThis = resolvingId === incident.incidentId;

              return (
                <div
                  key={incident.incidentId}
                  onClick={() => onSelectIncident(incident)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                        {incident.incidentId}
                      </span>
                      <Badge label={incident.status} status={incident.status} />
                      <Badge label={incident.severity} status={incident.severity} />
                    </div>

                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(incident.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                    {incident.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Reported by: <span style={{ color: '#e2e8f0' }}>{incident.reportedBy}</span>
                      {incident.vehicleId && ` • Vehicle: ${incident.vehicleId}`}
                      {incident.routeId && ` • Route: ${incident.routeId}`}
                    </div>

                    {/* Spec §3.3: Guarded state transitions strictly enforced */}
                    <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      {canTransition(incident.status, 'ACKNOWLEDGED') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onTransition(incident.incidentId, 'ACKNOWLEDGED')}
                        >
                          Acknowledge
                        </Button>
                      )}

                      {canTransition(incident.status, 'RESOLVED') && !isResolvingThis && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setResolvingId(incident.incidentId)}
                        >
                          Resolve...
                        </Button>
                      )}

                      {incident.status === 'RESOLVED' && (
                        <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                          &check; Resolved
                        </span>
                      )}
                    </div>
                  </div>

                  {isResolvingThis && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        marginTop: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '12px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <label style={{ fontSize: '11px', color: '#94a3b8' }}>Resolution Notes:</label>
                      <input
                        type="text"
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="e.g. Unit inspected, sensor recalibrated, back in service."
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: '#090d16',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          disabled={!resolutionNote.trim()}
                          onClick={() => handleResolveSubmit(incident.incidentId)}
                        >
                          Confirm Resolution
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
