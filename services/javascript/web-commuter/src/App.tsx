import React, { useEffect, useState, useMemo } from 'react';
import { useVehiclesStore } from './state/vehicles';
import { useTransformStore } from './state/transform';
import { useSelectionStore } from './state/selection';
import { useSearchStore } from './state/search';
import {
  initTransitSocket,
  disconnectTransitSocket,
  subscribeToRoute,
  unsubscribeFromRoute,
} from './api/socket';
import {
  getRoutes,
  getStops,
  getLiveVehicles,
  getRouteStops,
} from './api/transit.api';

import { RouteGeometry, Stop, Vehicle } from '@ecotransit/contracts';
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
  const searchResults = useSearchStore((state) => state.results);

  // Extract all matched routes between from & to stop clusters
  const matchedRouteIds = useMemo(() => {
    const set = new Set<string>();
    for (const j of searchResults) {
      for (const s of j.segments) {
        if (s.routeId) set.add(s.routeId);
      }
    }
    return Array.from(set);
  }, [searchResults]);

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

  // 2. Fetch live data from API Gateway with graceful fallback
  useEffect(() => {
    let isMounted = true;

    async function bootstrapTransitData() {
      try {
        const [backendRoutes, backendStops, backendVehicles] = await Promise.all([
          getRoutes(),
          getStops(5000, DELHI.lat, DELHI.lon, 150),
          getLiveVehicles(),
        ]);

        if (isMounted) {
          // If routes loaded from backend
          if (backendRoutes && backendRoutes.length > 0) {
            setRoutes(backendRoutes);
          } else {
            const fallback = generateCityTransit(DELHI.name, DELHI.lat, DELHI.lon);
            setRoutes(fallback.routes);
          }

          // If stops loaded from backend
          if (backendStops && backendStops.length > 0) {
            setStops(backendStops);
          } else {
            const fallback = generateCityTransit(DELHI.name, DELHI.lat, DELHI.lon);
            setStops(fallback.stops);
          }

          // If live vehicles loaded from backend
          if (backendVehicles && backendVehicles.length > 0) {
            const vehicleMap: Record<string, Vehicle> = {};
            for (const v of backendVehicles) {
              vehicleMap[v.vehicleId] = v;
            }
            useVehiclesStore.getState().updateVehicles(vehicleMap);
          } else {
            // Seed realistic initial positions if Redis buffer is currently quiet
            const fallback = generateCityTransit(DELHI.name, DELHI.lat, DELHI.lon);
            useVehiclesStore.getState().updateVehicles(fallback.vehicles);
          }
        }
      } catch (err) {
        console.warn('[App] Backend not reachable, using fallback transit topology:', err);
        if (isMounted) {
          const fallback = generateCityTransit(DELHI.name, DELHI.lat, DELHI.lon);
          setRoutes(fallback.routes);
          setStops(fallback.stops);
          useVehiclesStore.getState().updateVehicles(fallback.vehicles);
        }
      }
    }

    bootstrapTransitData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Handle route selection: dynamically fetch stops to build polyline & subscribe to route telemetry
  useEffect(() => {
    if (!selectedRoute) return;

    subscribeToRoute(selectedRoute);

    const activeRoute = routes.find((r) => r.routeId === selectedRoute);
    if (activeRoute && (!activeRoute.path || activeRoute.path.length === 0)) {
      getRouteStops(selectedRoute)
        .then((routeStops) => {
          if (routeStops.length > 0) {
            const pathCoords: [number, number][] = routeStops.map((s) => [s.latitude, s.longitude]);
            setRoutes((prevRoutes) =>
              prevRoutes.map((r) => (r.routeId === selectedRoute ? { ...r, path: pathCoords } : r))
            );
            // Also add stops if not already present
            setStops((prevStops) => {
              const existingIds = new Set(prevStops.map((s) => s.stopId));
              const newStops = routeStops.filter((s) => !existingIds.has(s.stopId));
              return newStops.length > 0 ? [...prevStops, ...newStops] : prevStops;
            });
          }
        })
        .catch((err) => {
          console.warn(`[App] Could not load stop path for route ${selectedRoute}:`, err);
        });
    }

    return () => {
      unsubscribeFromRoute(selectedRoute);
    };
  }, [selectedRoute, routes]);

  // 4. Dynamically fetch paths for all matched routes between from & to stop clusters
  useEffect(() => {
    if (matchedRouteIds.length === 0) return;
    for (const routeId of matchedRouteIds) {
      const activeRoute = routes.find((r) => r.routeId === routeId);
      if (activeRoute && (!activeRoute.path || activeRoute.path.length === 0)) {
        getRouteStops(routeId)
          .then((routeStops) => {
            if (routeStops.length > 0) {
              const pathCoords: [number, number][] = routeStops.map((s) => [s.latitude, s.longitude]);
              setRoutes((prevRoutes) =>
                prevRoutes.map((r) => (r.routeId === routeId ? { ...r, path: pathCoords } : r))
              );
              setStops((prevStops) => {
                const existingIds = new Set(prevStops.map((s) => s.stopId));
                const newStops = routeStops.filter((s) => !existingIds.has(s.stopId));
                return newStops.length > 0 ? [...prevStops, ...newStops] : prevStops;
              });
            }
          })
          .catch((err) => {
            console.warn(`[App] Could not load stop path for matched route ${routeId}:`, err);
          });
      }
    }
  }, [matchedRouteIds, routes]);

  const legendItems = useMemo(() => {
    const idsToShow = matchedRouteIds.length > 0
      ? matchedRouteIds
      : selectedRoute
      ? [selectedRoute]
      : [];
    const set = new Set(idsToShow);
    return routes
      .filter((r) => set.has(r.routeId))
      .map((r) => ({ label: r.name, color: r.color }));
  }, [routes, matchedRouteIds, selectedRoute]);

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
        <SearchPanel routes={routes} stops={stops} />

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
            matchedRouteIds={matchedRouteIds}
            onSelectVehicle={setSelectedVehicle}
            onSelectRoute={setSelectedRoute}
            onSelectStop={setSelectedStop}
            center={[28.6139, 77.2090]}
            zoom={12}
            showAllRoutesOnMount={false}
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

        {/* Floating Right Detail Panel (bus tap with live ETA calculation) */}
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
