import { useEffect, useRef, useState } from 'react';
import { Vehicle } from '@ecotransit/contracts';

interface PositionSnapshot {
  lat: number;
  lon: number;
  heading: number;
  timestamp: number;
}

/**
 * Spec §10.2:
 * Interpolation hook that smoothly animates positions between 5-second frames.
 */
export function useInterpolatedPositions(
  vehicles: Record<string, Vehicle>,
  interpolationDuration = 5000
): Record<string, { lat: number; lon: number; heading: number }> {
  const previousPositionsRef = useRef<Record<string, PositionSnapshot>>({});
  const targetPositionsRef = useRef<Record<string, PositionSnapshot>>({});
  const [interpolated, setInterpolated] = useState<Record<string, { lat: number; lon: number; heading: number }>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const newTargets: Record<string, PositionSnapshot> = {};

    for (const [id, v] of Object.entries(vehicles)) {
      newTargets[id] = {
        lat: v.latitude,
        lon: v.longitude,
        heading: v.heading ?? 0,
        timestamp: now,
      };

      if (!previousPositionsRef.current[id]) {
        previousPositionsRef.current[id] = newTargets[id]!;
      }
    }

    targetPositionsRef.current = newTargets;
  }, [vehicles]);

  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;
      const now = Date.now();
      const current: Record<string, { lat: number; lon: number; heading: number }> = {};

      for (const [id, target] of Object.entries(targetPositionsRef.current)) {
        const prev = previousPositionsRef.current[id] || target;
        const elapsed = now - target.timestamp;
        const progress = Math.min(Math.max(elapsed / interpolationDuration, 0), 1);

        current[id] = {
          lat: prev.lat + (target.lat - prev.lat) * progress,
          lon: prev.lon + (target.lon - prev.lon) * progress,
          heading: target.heading,
        };
      }

      setInterpolated(current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [interpolationDuration]);

  return interpolated;
}

export default useInterpolatedPositions;
