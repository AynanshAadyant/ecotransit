import React, { useEffect, useState } from 'react';
import { useSelectionStore } from '../state/selection';
import { useVehiclesStore } from '../state/vehicles';
import { Badge, Button } from '@ecotransit/ui';
import { getEta, getRouteStops } from '../api/transit.api';
import { Stop, EtaResponse } from '@ecotransit/contracts';

export const BusDetail: React.FC = () => {
  const { selectedVehicle, selectedStop, setSelectedVehicle, setSelectedStop } = useSelectionStore();

  const vehicle = useVehiclesStore((state) =>
    selectedVehicle ? state.vehicles[selectedVehicle] : null
  );

  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [eta, setEta] = useState<EtaResponse | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [etaError, setEtaError] = useState<string | null>(null);

  // Load stops for vehicle's assigned route
  useEffect(() => {
    if (!vehicle?.routeId) {
      setRouteStops([]);
      return;
    }

    let isMounted = true;
    getRouteStops(vehicle.routeId)
      .then((stops) => {
        if (isMounted) {
          setRouteStops(stops);
          // If no stop currently selected and route has stops, default target to the last or next stop
          if (!selectedStop && stops.length > 0) {
            setSelectedStop(stops[stops.length - 1]?.stopId ?? null);
          }
        }
      })
      .catch((err) => {
        console.warn('[BusDetail] Could not fetch route stops:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [vehicle?.routeId, selectedStop, setSelectedStop]);

  // Fetch real-time range-sum ETA whenever vehicle or target stop changes
  useEffect(() => {
    if (!selectedVehicle || !selectedStop) {
      setEta(null);
      setEtaError(null);
      return;
    }

    let isMounted = true;
    setEtaLoading(true);
    setEtaError(null);

    getEta(selectedVehicle, selectedStop)
      .then((result) => {
        if (isMounted) {
          setEta(result);
          setEtaLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'ETA currently unavailable';
          setEtaError(msg);
          setEta(null);
          setEtaLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVehicle, selectedStop]);

  if (!selectedVehicle) {
    return null;
  }

  const formatEta = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (mins === 0) return `${remSec}s`;
    return `${mins}m ${remSec}s`;
  };

  const selectedStopObj = routeStops.find((s) => s.stopId === selectedStop);

  return (
    <div
      className="bus-detail-panel"
      style={{
        position: 'absolute',
        top: '40px',
        right: '40px',
        width: '520px',
        maxWidth: 'calc(100vw - 80px)',
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '28px 32px',
        color: '#f8fafc',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
        zIndex: 1200,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
            Live Vehicle Telemetry
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>
            {selectedVehicle}
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedVehicle(null)} title="Close">
          &times;
        </Button>
      </div>

      {vehicle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Assigned Route</span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#38bdf8' }}>
              {vehicle.routeId || 'Unassigned'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Occupancy Status</span>
            <Badge
              label={vehicle.occupancyStatus || 'MANY_SEATS'}
              status={vehicle.occupancyStatus === 'FULL' ? 'HIGH' : 'LOW'}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Speed</span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>
              {vehicle.speed !== undefined ? `${Math.round(vehicle.speed)} km/h` : 'Tracking'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Heading / Bearing</span>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#cbd5e1' }}>
              {vehicle.heading !== undefined ? `${Math.round(vehicle.heading)}°` : 'N/A'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>GPS Position</span>
            <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#cbd5e1' }}>
              {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Last Updated</span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleTimeString() : 'Live'}
            </span>
          </div>

          {/* Real-time Range-Sum ETA Card */}
          <div
            style={{
              marginTop: '12px',
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.04em' }}>
                ⏱️ Predictive Range-Sum ETA
              </span>
              {etaLoading && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Calculating...</span>}
            </div>

            {/* Target Stop Selector */}
            {routeStops.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Target Destination Stop:</label>
                <select
                  value={selectedStop || ''}
                  onChange={(e) => setSelectedStop(e.target.value || null)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    padding: '6px 8px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {routeStops.map((s) => (
                    <option key={s.stopId} value={s.stopId}>
                      {s.displayName || s.stopName || s.name || s.stopId}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {eta ? (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <div>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: '#34d399' }}>
                    {formatEta(eta.eta_seconds)}
                  </span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    to {selectedStopObj?.displayName || selectedStopObj?.stopName || selectedStop}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: eta.weakest_cell_support > 30 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: eta.weakest_cell_support > 30 ? '#34d399' : '#fbbf24',
                      fontWeight: 600,
                    }}
                  >
                    {eta.weakest_cell_support > 30 ? 'High Confidence (ML)' : 'Moderate Support'}
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                    Variance: ±{Math.round(eta.variance_total)}s
                  </div>
                </div>
              </div>
            ) : etaError ? (
              <div style={{ fontSize: '12px', color: '#f87171' }}>
                {etaError}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Select a downstream stop to compute live traversal ETA.
              </div>
            )}
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
