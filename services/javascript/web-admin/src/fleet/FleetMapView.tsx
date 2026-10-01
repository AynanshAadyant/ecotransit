import React, { useState } from 'react';
import { MapCanvas, MapBackground, BusMarkerLayer, HeatmapLayer, LeafletTransitMap } from '@ecotransit/ui/map';
import { Vehicle, RouteGeometry, Stop, HeatmapBucket } from '@ecotransit/contracts';

interface FleetMapViewProps {
  vehicles: Record<string, Vehicle>;
  routes: RouteGeometry[];
  stops: Stop[];
  heatmapBuckets?: HeatmapBucket[];
  selectedVehicleId: string | null;
  selectedRouteId: string | null;
  onSelectVehicle: (id: string) => void;
  onSelectRoute: (id: string) => void;
}

/**
 * Spec §3.2 / §10.3:
 * Reuses rather than reimplements the map from @ecotransit/ui/map.
 * Supports OpenStreetMap (Leaflet) and Vector Canvas.
 */
export const FleetMapView: React.FC<FleetMapViewProps> = ({
  vehicles,
  routes,
  stops,
  heatmapBuckets = [],
  selectedVehicleId,
  selectedRouteId,
  onSelectVehicle,
  onSelectRoute,
}) => {
  const [zoom, setZoom] = useState(1);
  const [engine, setEngine] = useState<'leaflet' | 'canvas'>('leaflet');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {engine === 'leaflet' ? (
        <LeafletTransitMap
          vehicles={vehicles}
          routes={routes}
          stops={stops}
          selectedVehicleId={selectedVehicleId}
          selectedRouteId={selectedRouteId}
          onSelectVehicle={onSelectVehicle}
          onSelectRoute={onSelectRoute}
        />
      ) : (
        <MapCanvas
          onTransformChange={(t) => setZoom(t.zoom)}
          height="100%"
          width="100%"
        >
          <MapBackground
            routes={routes}
            stops={stops}
            selectedRouteId={selectedRouteId}
            onSelectRoute={onSelectRoute}
          />
          <HeatmapLayer buckets={heatmapBuckets} selectedRouteId={selectedRouteId} />
          <BusMarkerLayer
            vehicles={vehicles}
            zoom={zoom}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={onSelectVehicle}
          />
        </MapCanvas>
      )}

      {/* Floating Engine Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 1000,
          display: 'flex',
          gap: '4px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          padding: '3px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={() => setEngine('leaflet')}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            background: engine === 'leaflet' ? '#0284c7' : 'transparent',
            color: engine === 'leaflet' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          🗺️ Geographic
        </button>
        <button
          onClick={() => setEngine('canvas')}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            background: engine === 'canvas' ? '#0284c7' : 'transparent',
            color: engine === 'canvas' ? '#ffffff' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          ⚡ Canvas Vector
        </button>
      </div>
    </div>
  );
};
