import React from 'react';
import { Vehicle } from '@ecotransit/contracts';
import { Badge, Button } from '@ecotransit/ui';

interface FleetMatrixProps {
  vehicles: Record<string, Vehicle>;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

export const FleetMatrix: React.FC<FleetMatrixProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const vehicleList = Object.values(vehicles);

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
            Fleet Telemetry Matrix
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {vehicleList.length} active autonomous & hybrid buses
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {vehicleList.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No live telemetry units transmitting in this sector.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Vehicle ID</th>
                <th style={{ padding: '12px 16px' }}>Route</th>
                <th style={{ padding: '12px 16px' }}>Coordinates</th>
                <th style={{ padding: '12px 16px' }}>Occupancy</th>
                <th style={{ padding: '12px 16px' }}>Speed</th>
                <th style={{ padding: '12px 16px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicleList.map((v) => {
                const isSelected = selectedVehicleId === v.vehicleId;
                return (
                  <tr
                    key={v.vehicleId}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => onSelectVehicle(v.vehicleId)}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f8fafc' }}>
                      {v.vehicleId}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#38bdf8' }}>
                      {v.routeId}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#cbd5e1', fontSize: '12px' }}>
                      {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge label={v.occupancyStatus || 'MANY_SEATS'} status={v.occupancyStatus || 'LOW'} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {v.speed !== undefined ? `${v.speed} km/h` : '18 km/h'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Button
                        size="sm"
                        variant={isSelected ? 'success' : 'secondary'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectVehicle(v.vehicleId);
                        }}
                      >
                        {isSelected ? 'Focused' : 'Locate'}
                      </Button>
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
