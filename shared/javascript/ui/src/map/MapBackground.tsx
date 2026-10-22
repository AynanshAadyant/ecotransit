import React from 'react';
import { RouteGeometry, Stop } from '@ecotransit/contracts';
import { projectGeoToCanvas } from './projection';

export interface MapBackgroundProps {
  routes: RouteGeometry[];
  stops: Stop[];
  selectedRouteId?: string | null;
  onSelectRoute?: (id: string) => void;
  onSelectStop?: (id: string) => void;
}

export const MapBackground: React.FC<MapBackgroundProps> = React.memo(
  ({ routes, stops, selectedRouteId, onSelectRoute, onSelectStop }) => {
    return (
      <g className="map-background-layer">
        {/* Route Polylines */}
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.routeId;
          const points = route.path
            .map(([lat, lon]) => {
              const { x, y } = projectGeoToCanvas(lat, lon);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

          return (
            <polyline
              key={route.routeId}
              points={points}
              fill="none"
              stroke={route.color || '#38bdf8'}
              strokeWidth={isSelected ? 6 : 3}
              strokeOpacity={isSelected ? 1 : 0.65}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: 'pointer', transition: 'stroke-width 0.2s' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRoute?.(route.routeId);
              }}
            >
              <title>{route.name || route.routeId}</title>
            </polyline>
          );
        })}

        {/* Transit Stops */}
        {stops.map((stop) => {
          const { x, y } = projectGeoToCanvas(stop.latitude, stop.longitude);
          const stopTitle = stop.name || stop.stopName || stop.displayName || stop.stopId;

          return (
            <g
              key={stop.stopId}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectStop?.(stop.stopId);
              }}
            >
              <circle
                r={4}
                fill="#090d16"
                stroke="#38bdf8"
                strokeWidth={2}
                opacity={0.85}
              />
              <title>{stopTitle}</title>
            </g>
          );
        })}
      </g>
    );
  }
);

export default MapBackground;
