import React from 'react';
import { Vehicle } from '@ecotransit/contracts';
import { projectGeoToCanvas } from './projection';

export interface BusMarkerLayerProps {
  vehicles: Record<string, Vehicle>;
  zoom?: number;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (id: string) => void;
}

export const BusMarkerLayer: React.FC<BusMarkerLayerProps> = ({
  vehicles,
  zoom = 1,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const vehicleList = Object.values(vehicles);
  // Inverse scale to maintain marker size irrespective of viewport zoom
  const invScale = 1 / Math.max(zoom, 0.2);

  return (
    <g className="bus-marker-layer">
      {vehicleList.map((v) => {
        const { x, y } = projectGeoToCanvas(v.latitude, v.longitude);
        const isSelected = selectedVehicleId === v.vehicleId;
        const heading = v.heading ?? 0;

        // Occupancy status color
        let markerColor = '#10b981'; // default green
        if (v.occupancyStatus === 'FULL' || v.occupancyStatus === 'CRUSHED_STANDING_ROOM') {
          markerColor = '#ef4444';
        } else if (v.occupancyStatus === 'FEW_SEATS' || v.occupancyStatus === 'STANDING_ROOM_ONLY' || v.occupancyStatus === 'STANDING_ONLY') {
          markerColor = '#f59e0b';
        }

        return (
          <g
            key={v.vehicleId}
            transform={`translate(${x}, ${y}) scale(${invScale})`}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectVehicle?.(v.vehicleId);
            }}
          >
            {/* Pulsing selection aura */}
            {isSelected && (
              <circle
                r={16}
                fill="none"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 2"
                opacity={0.8}
              />
            )}

            {/* Vehicle base circle */}
            <circle
              r={9}
              fill={markerColor}
              stroke="#ffffff"
              strokeWidth={1.5}
            />

            {/* Direction indicator triangle */}
            <path
              d="M 0 -7 L 4 -2 L -4 -2 Z"
              fill="#ffffff"
              transform={`rotate(${heading})`}
            />

            {/* Vehicle label */}
            <text
              y={-14}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize={10}
              fontWeight={700}
              style={{
                textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 2px #000',
                pointerEvents: 'none',
              }}
            >
              {v.vehicleId}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export default BusMarkerLayer;
