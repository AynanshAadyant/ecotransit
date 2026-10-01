import React from 'react';
import { useSelectionStore } from '../state/selection';
import { useVehiclesStore } from '../state/vehicles';
import { Badge, Button } from '@ecotransit/ui';

export const BusDetail: React.FC = () => {
  const { selectedVehicle, setSelectedVehicle } = useSelectionStore();

  // Spec §2.7: Reads selected vehicle record directly from vehicles store; NO fresh fetch!
  const vehicle = useVehiclesStore((state) =>
    selectedVehicle ? state.vehicles[selectedVehicle] : null
  );

  if (!selectedVehicle) {
    return null;
  }

  return (
    <div
      className="bus-detail-panel"
      style={{
        position: 'absolute',
        top: '40px',
        right: '40px',
        width: '540px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '36px',
        color: '#f8fafc',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 1200,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <span style={{ fontSize: '18px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
            Live Vehicle Telemetry
          </span>
          <h3 style={{ margin: '6px 0 0', fontSize: '32px', fontWeight: 700, color: '#f8fafc' }}>
            {selectedVehicle}
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedVehicle(null)} title="Close">
          &times;
        </Button>
      </div>

      {vehicle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>Assigned Route</span>
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#38bdf8' }}>
              {vehicle.routeId}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>Occupancy</span>
            <Badge
              label={vehicle.occupancyStatus || 'MANY_SEATS'}
              status={vehicle.occupancyStatus === 'FULL' ? 'HIGH' : 'LOW'}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>Speed</span>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>
              {vehicle.speed !== undefined ? `${vehicle.speed} km/h` : 'Tracking'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>Coordinates</span>
            <span style={{ fontSize: '18px', fontFamily: 'monospace', color: '#cbd5e1' }}>
              {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>Last Updated</span>
            <span style={{ fontSize: '18px', color: '#64748b' }}>
              {vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleTimeString() : 'Live'}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 0', fontSize: '13px', color: '#94a3b8' }}>
          Telemetry stream synchronizing...
        </div>
      )}
    </div>
  );
};
