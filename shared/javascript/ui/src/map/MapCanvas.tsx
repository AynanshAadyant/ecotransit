import React, { useRef, useState, useCallback } from 'react';

export interface Transform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface MapCanvasProps {
  children?: React.ReactNode;
  onTransformChange?: (transform: Transform) => void;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  children,
  onTransformChange,
  width = '100%',
  height = '100%',
  style,
}) => {
  const [transform, setTransform] = useState<Transform>({ zoom: 1, panX: 0, panY: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<SVGSVGElement | null>(null);

  const updateTransform = useCallback(
    (next: Transform | ((prev: Transform) => Transform)) => {
      setTransform((prev) => {
        const val = typeof next === 'function' ? next(prev) : next;
        if (onTransformChange) {
          onTransformChange(val);
        }
        return val;
      });
    },
    [onTransformChange]
  );

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only drag on left click and not on interactive SVG children (or drag anywhere on SVG background)
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    updateTransform((prev) => ({
      ...prev,
      panX: dragStartRef.current.panX + dx,
      panY: dragStartRef.current.panY + dy,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    updateTransform((prev) => {
      const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.2), 15);
      return {
        ...prev,
        zoom: nextZoom,
      };
    });
  };

  return (
    <svg
      ref={containerRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#090d16',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        display: 'block',
        overflow: 'hidden',
        ...style,
      }}
    >
      <defs>
        {/* Subtle grid pattern */}
        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.08)" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid-pattern)" />

      <g transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.zoom})`}>
        {children}
      </g>
    </svg>
  );
};

export default MapCanvas;
