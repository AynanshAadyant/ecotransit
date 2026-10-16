import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteGeometry, Stop, Vehicle } from '@ecotransit/contracts';

export interface LeafletTransitMapProps {
  vehicles: Record<string, Vehicle>;
  routes: RouteGeometry[];
  stops: Stop[];
  selectedVehicleId?: string | null | undefined;
  selectedRouteId?: string | null | undefined;
  onSelectVehicle?: ((id: string) => void) | undefined;
  onSelectRoute?: ((id: string) => void) | undefined;
  onSelectStop?: ((id: string) => void) | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  showAllRoutesOnMount?: boolean | undefined;
}

/**
 * Stacked Layer 1: Cached Base Map Tile Layer.
 * Wrapped in React.memo with zero dynamic dependencies.
 * Caches the CartoDB dark tile layer so live telemetry bursts (5s frame updates)
 * and route searches NEVER trigger tile layer re-renders or tile re-requests.
 */
const CachedBaseTileLayer = memo(() => {
  return (
    <>
      <style>{`
        .dark-osm-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7) !important;
        }
        .leaflet-container {
          background: #090d16 !important;
        }
      `}</style>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="dark-osm-tiles"
        maxZoom={19}
      />
    </>
  );
});
CachedBaseTileLayer.displayName = 'CachedBaseTileLayer';

/**
 * Stacked Layer 2: Active Searched Route Layer.
 * Renders ONLY the searched/active route on top of the base map.
 * On mount (with no route searched), renders null.
 */
interface ActiveRouteLayerProps {
  routes: RouteGeometry[];
  selectedRouteId?: string | null | undefined;
  showAllRoutesOnMount?: boolean | undefined;
  onSelectRoute?: ((id: string) => void) | undefined;
}

const ActiveRouteLayer = memo<ActiveRouteLayerProps>(({
  routes,
  selectedRouteId,
  showAllRoutesOnMount,
  onSelectRoute,
}) => {
  const routesToRender = useMemo(() => {
    if (selectedRouteId) {
      return routes.filter((r) => r.routeId === selectedRouteId);
    }
    return showAllRoutesOnMount ? routes : [];
  }, [routes, selectedRouteId, showAllRoutesOnMount]);

  if (routesToRender.length === 0) return null;

  return (
    <>
      {routesToRender.map((route) => {
        const isSelected = selectedRouteId === route.routeId;
        const routeColor = route.color || '#38bdf8';

        return (
          <React.Fragment key={route.routeId}>
            {/* Outer translucent glow highlighting the searched corridor */}
            <Polyline
              positions={route.path as [number, number][]}
              pathOptions={{
                color: routeColor,
                weight: isSelected ? 12 : 6,
                opacity: 0.3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Core sharp vector polyline */}
            <Polyline
              positions={route.path as [number, number][]}
              pathOptions={{
                color: routeColor,
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 1 : 0.75,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              eventHandlers={{
                click: () => onSelectRoute?.(route.routeId),
              }}
            >
              <Tooltip sticky>
                <div style={{ padding: '3px 6px', fontSize: '13px', fontWeight: 600 }}>
                  <span style={{ color: routeColor, marginRight: '4px' }}>●</span>
                  {route.name}
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                    Route ID: {route.routeId} &bull; {route.path.length} Waypoints
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          </React.Fragment>
        );
      })}
    </>
  );
});
ActiveRouteLayer.displayName = 'ActiveRouteLayer';

/**
 * Stacked Layer 3: Active Route Stops Layer.
 * On mount with no route searched, renders null (no stop markers).
 * When a route is searched, only stops on or adjacent to that route are mounted.
 */
interface ActiveRouteStopsLayerProps {
  stops: Stop[];
  selectedRoute?: RouteGeometry | null | undefined;
  showAllRoutesOnMount?: boolean | undefined;
  onSelectStop?: ((id: string) => void) | undefined;
}

const ActiveRouteStopsLayer = memo<ActiveRouteStopsLayerProps>(({
  stops,
  selectedRoute,
  showAllRoutesOnMount,
  onSelectStop,
}) => {
  const stopsToRender = useMemo(() => {
    if (!selectedRoute && !showAllRoutesOnMount) return [];
    if (!selectedRoute) return stops;

    // Filter stops proximate to the searched route's coordinates
    return stops.filter((stop) => {
      return selectedRoute.path.some(([lat, lon]) => {
        const dLat = Math.abs(lat - stop.latitude);
        const dLon = Math.abs(lon - stop.longitude);
        return dLat < 0.012 && dLon < 0.012; // ~1km spatial proximity threshold
      });
    });
  }, [stops, selectedRoute, showAllRoutesOnMount]);

  if (stopsToRender.length === 0) return null;

  return (
    <>
      {stopsToRender.map((stop) => {
        const name = stop.name || stop.stopName || stop.displayName || stop.stopId;
        return (
          <CircleMarker
            key={stop.stopId}
            center={[stop.latitude, stop.longitude]}
            radius={4}
            pathOptions={{
              color: '#38bdf8',
              weight: 2,
              fillColor: '#090d16',
              fillOpacity: 0.95,
            }}
            eventHandlers={{
              click: () => onSelectStop?.(stop.stopId),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>
                🚏 {name}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
});
ActiveRouteStopsLayer.displayName = 'ActiveRouteStopsLayer';

/**
 * Stacked Layer 4: Viewport-Filtered Live Bus Layer.
 * On mount with no route searched, renders null (no buses mounted).
 * When a route is searched, mounts only live buses on that route that fall
 * strictly inside the current map viewport bounds.
 * Dynamically re-evaluates on moveend / zoomend.
 */
interface ViewportLiveBusesLayerProps {
  vehicles: Record<string, Vehicle>;
  selectedRouteId?: string | null | undefined;
  selectedVehicleId?: string | null | undefined;
  showAllRoutesOnMount?: boolean | undefined;
  onSelectVehicle?: ((id: string) => void) | undefined;
}

const ViewportLiveBusesLayer: React.FC<ViewportLiveBusesLayerProps> = ({
  vehicles,
  selectedRouteId,
  selectedVehicleId,
  showAllRoutesOnMount,
  onSelectVehicle,
}) => {
  const map = useMap();
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(() => {
    try {
      return map.getBounds();
    } catch {
      return null;
    }
  });

  // Track map viewport bounding box on pan & zoom
  useMapEvents({
    moveend: () => {
      try {
        setViewportBounds(map.getBounds());
      } catch {
        // ignore
      }
    },
    zoomend: () => {
      try {
        setViewportBounds(map.getBounds());
      } catch {
        // ignore
      }
    },
  });

  // Filter vehicles by active route AND viewport spatial containment
  const visibleVehicles = useMemo(() => {
    if (!selectedRouteId && !showAllRoutesOnMount) return [];

    const all = Object.values(vehicles);
    return all.filter((v) => {
      if (v.latitude == null || v.longitude == null) return false;
      // Must be on the searched route
      if (selectedRouteId && v.routeId !== selectedRouteId) return false;
      // Must be within current viewport bounds
      if (viewportBounds) {
        return viewportBounds.contains([v.latitude, v.longitude]);
      }
      return true;
    });
  }, [vehicles, selectedRouteId, showAllRoutesOnMount, viewportBounds]);

  if (visibleVehicles.length === 0) return null;

  return (
    <>
      {visibleVehicles.map((v) => {
        const isSelected = selectedVehicleId === v.vehicleId;
        let markerColor = '#10b981'; // Green: normal capacity
        if (v.occupancyStatus === 'FULL' || v.occupancyStatus === 'CRUSHED_STANDING_ROOM') {
          markerColor = '#ef4444'; // Red: full
        } else if (
          v.occupancyStatus === 'FEW_SEATS' ||
          v.occupancyStatus === 'STANDING_ROOM_ONLY' ||
          v.occupancyStatus === 'STANDING_ONLY'
        ) {
          markerColor = '#f59e0b'; // Amber: standing only
        }

        return (
          <CircleMarker
            key={v.vehicleId}
            center={[v.latitude, v.longitude]}
            radius={isSelected ? 10 : 7.5}
            pathOptions={{
              color: isSelected ? '#ffffff' : markerColor,
              weight: isSelected ? 3 : 2,
              fillColor: markerColor,
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => onSelectVehicle?.(v.vehicleId),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div style={{ fontSize: '12px', lineHeight: '1.45', minWidth: '135px' }}>
                <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🚌 {v.vehicleId}</span>
                  <span style={{ color: markerColor, fontSize: '11px', fontWeight: 600 }}>
                    {v.speed != null ? `${Math.round(v.speed)} km/h` : 'Active'}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                  Route: <b>{v.routeId}</b>
                </div>
                {v.occupancyStatus && (
                  <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>
                    Occupancy: {v.occupancyStatus.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};

/**
 * Stacked Layer 5: Route Viewport Focus Controller.
 * Automatically fits map viewport bounds when a route is searched.
 * Programmatically pans to a vehicle when clicked.
 */
interface RouteFocusControllerProps {
  selectedRoute?: RouteGeometry | null | undefined;
  selectedVehicle?: Vehicle | undefined;
}

const RouteFocusController: React.FC<RouteFocusControllerProps> = ({
  selectedRoute,
  selectedVehicle,
}) => {
  const map = useMap();
  const prevRouteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  // Fit bounds to searched route
  useEffect(() => {
    if (
      selectedRoute &&
      selectedRoute.path &&
      selectedRoute.path.length > 0 &&
      selectedRoute.routeId !== prevRouteIdRef.current
    ) {
      prevRouteIdRef.current = selectedRoute.routeId;
      try {
        const bounds = L.latLngBounds(selectedRoute.path as [number, number][]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true });
      } catch {
        // Safe fallback
      }
    } else if (!selectedRoute) {
      prevRouteIdRef.current = null;
    }
  }, [selectedRoute, map]);

  // Pan to selected vehicle
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.latitude != null && selectedVehicle.longitude != null) {
      map.panTo([selectedVehicle.latitude, selectedVehicle.longitude], { animate: true });
    }
  }, [selectedVehicle, map]);

  return null;
};

/**
 * LeafletTransitMap — React-Leaflet Map Component with Layer Stacking & Render Isolation.
 *
 * Requirements fulfilled:
 * 1. Base Layer Caching: Base CartoDB Dark Matter tile layer is memoized and never re-rendered on telemetry ticks.
 * 2. On Mount: Only Delhi map is visible (no routes, no stop markers, no live buses).
 * 3. Route Search: When user searches for a route, the route polyline is created on the map.
 * 4. Viewport Live Buses: Only live buses belonging to that route located in the map viewport are mounted.
 */
export const LeafletTransitMap: React.FC<LeafletTransitMapProps> = ({
  vehicles,
  routes,
  stops,
  selectedVehicleId,
  selectedRouteId,
  onSelectVehicle,
  onSelectRoute,
  onSelectStop,
  center = [28.6139, 77.2090], // Delhi City Center
  zoom = 12,
  showAllRoutesOnMount = false,
}) => {
  const selectedRoute = useMemo(
    () => (selectedRouteId ? routes.find((r) => r.routeId === selectedRouteId) : null),
    [routes, selectedRouteId]
  );

  const selectedVehicle = selectedVehicleId ? vehicles[selectedVehicleId] : undefined;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        style={{ width: '100%', height: '100%', background: '#090d16' }}
        className="leaflet-transit-map"
      >
        {/* Layer 1: Cached Base Map (Insulated from re-renders) */}
        <CachedBaseTileLayer />

        {/* Layer 2: Zoom Controls */}
        <ZoomControl position="bottomright" />

        {/* Layer 3: Viewport Controller */}
        <RouteFocusController
          selectedRoute={selectedRoute}
          selectedVehicle={selectedVehicle}
        />

        {/* Layer 4: Active Searched Route Polyline */}
        <ActiveRouteLayer
          routes={routes}
          selectedRouteId={selectedRouteId}
          showAllRoutesOnMount={showAllRoutesOnMount}
          onSelectRoute={onSelectRoute}
        />

        {/* Layer 5: Active Route Stops */}
        <ActiveRouteStopsLayer
          stops={stops}
          selectedRoute={selectedRoute}
          showAllRoutesOnMount={showAllRoutesOnMount}
          onSelectStop={onSelectStop}
        />

        {/* Layer 6: Viewport Live Buses on Searched Route */}
        <ViewportLiveBusesLayer
          vehicles={vehicles}
          selectedRouteId={selectedRouteId}
          selectedVehicleId={selectedVehicleId}
          showAllRoutesOnMount={showAllRoutesOnMount}
          onSelectVehicle={onSelectVehicle}
        />
      </MapContainer>
    </div>
  );
};

export default LeafletTransitMap;
