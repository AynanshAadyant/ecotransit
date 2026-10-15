import React from 'react';
import { Incident } from '@ecotransit/contracts';
import { Badge, Button } from '@ecotransit/ui';

interface IncidentDetailProps {
  incident: Incident | null;
  onClose: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incident, onClose }) => {
  if (!incident) return null;

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '20px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Incident Record
          </span>
          <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700 }}>
            {incident.incidentId}
          </h3>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          &times;
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Badge label={incident.status} status={incident.status} />
        <Badge label={`Severity: ${incident.severity}`} status={incident.severity} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
          Description
        </label>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>
          {incident.description}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
        <div>
          <span style={{ color: '#94a3b8' }}>Reported By:</span>
          <div style={{ fontWeight: 600 }}>{incident.reportedBy}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Timestamp:</span>
          <div style={{ fontWeight: 600 }}>{new Date(incident.timestamp).toLocaleString()}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Assigned Vehicle:</span>
          <div style={{ fontWeight: 600 }}>{incident.vehicleId || 'N/A'}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Affected Route:</span>
          <div style={{ fontWeight: 600 }}>{incident.routeId || 'N/A'}</div>
        </div>
      </div>

      {incident.resolutionNotes && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#34d399', marginBottom: '4px' }}>
            Resolution Notes
          </label>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: '8px', fontSize: '13px', color: '#e2e8f0' }}>
            {incident.resolutionNotes}
          </div>
        </div>
      )}
    </div>
  );
};
