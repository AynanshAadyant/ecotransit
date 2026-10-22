import React from 'react';
import { HeatmapBucket } from '@ecotransit/contracts';

export interface HeatmapLayerProps {
  buckets?: HeatmapBucket[];
  selectedRouteId?: string | null;
}

export const HeatmapLayer: React.FC<HeatmapLayerProps> = React.memo(
  ({ buckets = [], selectedRouteId: _selectedRouteId }) => {
    if (!buckets.length) {
      return null;
    }

    return (
      <g className="heatmap-layer" opacity={0.65}>
        {/* Future expansion: segment-level congestion glow rendering */}
      </g>
    );
  }
);

export default HeatmapLayer;
