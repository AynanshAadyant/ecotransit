import React, { useState } from 'react';
import { Shift } from '@ecotransit/contracts';
import { Badge, Button } from '@ecotransit/ui';

interface StaffAdminProps {
  shifts: Shift[];
  onReassign: (shiftId: string, vehicleId: string, routeId: string) => void;
}

export const StaffAdmin: React.FC<StaffAdminProps> = ({ shifts, onReassign }) => {
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newRouteId, setNewRouteId] = useState('');

  const handleStartEdit = (shift: Shift) => {
    setEditingShiftId(shift.shiftId);
    setNewVehicleId(shift.assignedVehicleId);
    setNewRouteId(shift.assignedRouteId);
  };

  const handleSave = (shiftId: string) => {
    onReassign(shiftId, newVehicleId, newRouteId);
    setEditingShiftId(null);
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
        }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Staff Administration & Rostering
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Active operators, autonomous safety drivers, and vehicle dispatch assignments
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {shifts.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No shift rosters registered for current duty period.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Staff Operator</th>
                <th style={{ padding: '12px 16px' }}>Assigned Vehicle</th>
                <th style={{ padding: '12px 16px' }}>Assigned Route</th>
                <th style={{ padding: '12px 16px' }}>Shift Window</th>
                <th style={{ padding: '12px 16px' }}>Confirmation</th>
                <th style={{ padding: '12px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                const isEditing = editingShiftId === shift.shiftId;

                return (
                  <tr
                    key={shift.shiftId}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{shift.staffName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{shift.staffId}</div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={newVehicleId}
                          onChange={(e) => setNewVehicleId(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            background: '#090d16',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#f8fafc',
                            borderRadius: '4px',
                            fontSize: '12px',
                            width: '100px',
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                          {shift.assignedVehicleId}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={newRouteId}
                          onChange={(e) => setNewRouteId(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            background: '#090d16',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#f8fafc',
                            borderRadius: '4px',
                            fontSize: '12px',
                            width: '100px',
                          }}
                        />
                      ) : (
                        <span>{shift.assignedRouteId}</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                      {shift.startTime} &ndash; {shift.endTime}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <Badge
                        label={shift.confirmed ? 'Confirmed' : 'Pending'}
                        status={shift.confirmed ? 'RESOLVED' : 'ACKNOWLEDGED'}
                      />
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button size="sm" variant="success" onClick={() => handleSave(shift.shiftId)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingShiftId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleStartEdit(shift)}>
                          Reassign
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
