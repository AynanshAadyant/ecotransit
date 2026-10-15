import React, { useEffect, useState } from 'react';
import { useVehiclesStore } from './state/vehicles';
import { useTransformStore } from './state/transform';
import { useSelectionStore } from './state/selection';
import { initTransitSocket, disconnectTransitSocket } from './api/socket';

import { RouteGeometry, Stop } from '@ecotransit/contracts';
import { MapCanvas } from './map/MapCanvas';
import { MapBackground } from './map/MapBackground';
import { BusMarkerLayer } from './map/BusMarkerLayer';
import { HeatmapLayer } from './map/HeatmapLayer';
import { SearchPanel } from './panels/SearchPanel';
import { SearchResults } from './panels/SearchResults';
import { BusDetail } from './panels/BusDetail';
import { Header, Legend } from './components';
import { LeafletTransitMap } from '@ecotransit/ui/map';
import { generateCityTransit } from './api/cityTransit';

const DELHI = { name: 'Delhi', lat: 28.6139, lon: 77.2090 } as const;

export const App: React.FC = () => {
  // Store selectors (Spec §0.5: Store selectors, not React Context, for high-frequency state)
  const vehicles = useVehiclesStore((state) => state.vehicles);
  const connectionStatus = useVehiclesStore((state) => state.connectionStatus);
  const zoom = useTransformStore((state) => state.zoom);
  const setTransform = useTransformStore((state) => state.setTransform);

  const selectedVehicle = useSelectionStore((state) => state.selectedVehicle);
  const selectedRoute = useSelectionStore((state) => state.selectedRoute);
  const setSelectedVehicle = useSelectionStore((state) => state.setSelectedVehicle);
  const setSelectedRoute = useSelectionStore((state) => state.setSelectedRoute);
  const setSelectedStop = useSelectionStore((state) => state.setSelectedStop);

  // Static transit network geometry
  const [routes, setRoutes] = useState<RouteGeometry[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [mapEngine, setMapEngine] = useState<'leaflet' | 'canvas'>('leaflet');

  // 1. Establish socket connection with frame coalescing
  useEffect(() => {
    initTransitSocket(
      (incomingVehicles, timestamp) => {
        useVehiclesStore.getState().updateVehicles(incomingVehicles, timestamp);
      },
      (status) => {
        useVehiclesStore.getState().setConnectionStatus(status);
      }
    );

    return () => {
      disconnectTransitSocket();
    };
  }, []);

  // 2. Seed Delhi transit data on mount (no backend required)
  useEffect(() => {
    const delhi = generateCityTransit(DELHI.name, DELHI.lat, DELHI.lon);
    setRoutes(delhi.routes);
    setStops(delhi.stops);
    useVehiclesStore.getState().updateVehicles(delhi.vehicles);
  }, []);

  const legendItems = routes.map((r) => ({ label: r.name, color: r.color }));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <Header connectionStatus={connectionStatus} />

      {/* Top search bar — centred horizontally, sits between header and map */}
      <div
        style={{
          position: 'relative',
          zIndex: 1300,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 20px',
          gap: '12px',
          background: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <SearchPanel />

        {/* Map engine switcher — stays right-aligned */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '4px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setMapEngine('leaflet')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mapEngine === 'leaflet' ? '#10b981' : 'transparent',
              color: mapEngine === 'leaflet' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            🗺️ Geographic
          </button>
          <button
            onClick={() => setMapEngine('canvas')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mapEngine === 'canvas' ? '#10b981' : 'transparent',
              color: mapEngine === 'canvas' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            ⚡ Canvas
          </button>
        </div>
      </div>

      {/* Map — flex-fills remaining space */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {mapEngine === 'leaflet' ? (
          <LeafletTransitMap
            vehicles={vehicles}
            routes={routes}
            stops={stops}
            selectedVehicleId={selectedVehicle}
            selectedRouteId={selectedRoute}
            onSelectVehicle={setSelectedVehicle}
            onSelectRoute={setSelectedRoute}
            onSelectStop={setSelectedStop}
            center={[28.6139, 77.2090]}
            zoom={14}
          />
        ) : (
          <MapCanvas onTransformChange={setTransform}>
            <MapBackground
              routes={routes}
              stops={stops}
              selectedRouteId={selectedRoute}
              onSelectRoute={setSelectedRoute}
              onSelectStop={setSelectedStop}
            />
            <HeatmapLayer buckets={[]} selectedRouteId={selectedRoute} />
            <BusMarkerLayer
              vehicles={vehicles}
              zoom={zoom}
              selectedVehicleId={selectedVehicle}
              onSelectVehicle={setSelectedVehicle}
            />
          </MapCanvas>
        )}

        {/* Floating Right Detail Panel (bus tap) */}
        <BusDetail />

        {/* Bottom Legend */}
        {legendItems.length > 0 && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 1100 }}>
            <Legend items={legendItems} />
          </div>
        )}
      </main>

      {/* Bottom strip: Google Maps-style route options */}
      <SearchResults />
    </div>
  );
};

export default App;
