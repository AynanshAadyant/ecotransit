import React from 'react';
import { Shift } from '@ecotransit/contracts';
import { Badge, Button } from '@ecotransit/ui';

interface ShiftCardProps {
  shift: Shift | null;
  onConfirm: (shiftId: string) => void;
  isConfirming: boolean;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({ shift, onConfirm, isConfirming }) => {
  if (!shift) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px' }}>
        No active shift assigned for this device.
      </div>
    );
  }

  return (
    <div
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
            Duty Assignment
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 700 }}>
            {shift.assignedVehicleId}
          </h2>
        </div>
        <Badge
          label={shift.confirmed ? 'Confirmed' : 'Pending Ack'}
          status={shift.confirmed ? 'RESOLVED' : 'ACKNOWLEDGED'}
          size="md"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
        <div>
          <span style={{ color: '#94a3b8' }}>Assigned Corridor:</span>
          <div style={{ fontWeight: 600, color: '#38bdf8' }}>{shift.assignedRouteId}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Duty Window:</span>
          <div style={{ fontWeight: 600 }}>{shift.startTime} &ndash; {shift.endTime}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Operator:</span>
          <div style={{ fontWeight: 600 }}>{shift.staffName}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Shift ID:</span>
          <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{shift.shiftId}</div>
        </div>
      </div>

      {!shift.confirmed ? (
        <Button
          variant="primary"
          size="lg"
          isLoading={isConfirming}
          onClick={() => onConfirm(shift.shiftId)}
          style={{ width: '100%' }}
        >
          {isConfirming ? 'Acknowledging...' : 'Acknowledge & Start Shift'}
        </Button>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            color: '#34d399',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          &check; Shift Accepted and Broadcasting
        </div>
      )}
    </div>
  );
};
