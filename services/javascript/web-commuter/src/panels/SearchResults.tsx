import React from 'react';
import { useSearchStore } from '../state/search';
import { useSelectionStore } from '../state/selection';
import { JourneyResult } from '@ecotransit/contracts';

// Route type badge colours keyed on part of the route name/id
function getRouteAccent(routeId: string): string {
  if (routeId.includes('B1') || routeId.includes('B2')) return '#10b981'; // DTC bus – green
  if (routeId.includes('R1')) return '#f5c518'; // Yellow line
  if (routeId.includes('R2')) return '#2563eb'; // Blue line
  if (routeId.includes('R3')) return '#dc2626'; // Red line
  if (routeId.includes('R4')) return '#16a34a'; // Green line
  return '#38bdf8';
}

function formatFare(fare?: number) {
  if (!fare) return null;
  return `₹${fare}`;
}

interface JourneyCardProps {
  journey: JourneyResult;
  isSelected: boolean;
  onSelect: () => void;
}

const JourneyCard: React.FC<JourneyCardProps> = ({ journey, isSelected, onSelect }) => {
  const primarySegment = journey.segments[0];

  return (
    <div
      id={`journey-option-${journey.journeyId}`}
      onClick={onSelect}
      style={{
        minWidth: '360px',
        flex: '0 0 auto',
        background: isSelected
          ? 'rgba(16, 185, 129, 0.12)'
          : 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        border: `1.5px solid ${isSelected ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '20px',
        padding: '24px 32px',
        cursor: 'pointer',
        transition: 'border-color 0.18s, background 0.18s, transform 0.12s',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        boxShadow: isSelected ? '0 6px 24px rgba(16,185,129,0.2)' : '0 2px 12px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }
      }}
    >
      {/* Header row: duration + fare */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
            {journey.totalDurationMinutes} min
          </div>
          <div style={{ fontSize: '16px', color: '#64748b', marginTop: '6px' }}>
            {primarySegment?.departureTime} – {journey.segments[journey.segments.length - 1]?.arrivalTime}
          </div>
        </div>
        {journey.fare != null && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '6px 16px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#10b981',
            }}
          >
            {formatFare(journey.fare)}
          </div>
        )}
      </div>

      {/* Segments / route pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {journey.segments.map((seg, idx) => (
          <div key={seg.segmentId}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '18px',
              }}
            >
              {/* Route pill */}
              <span
                style={{
                  background: getRouteAccent(seg.routeId),
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '16px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {seg.routeName}
              </span>
              {/* Stop span */}
              <span style={{ color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {seg.fromStop} → {seg.toStop}
              </span>
              <span style={{ marginLeft: 'auto', color: '#64748b', flexShrink: 0, fontSize: '16px' }}>
                {seg.durationMinutes}m
              </span>
            </div>
            {/* Interchange connector */}
            {idx < journey.segments.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0 6px 8px' }}>
                <div
                  style={{
                    width: '2px',
                    height: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    marginLeft: '8px',
                  }}
                />
                <span style={{ fontSize: '16px', color: '#64748b' }}>change at {seg.toStop}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div
          style={{
            marginTop: '16px',
            padding: '10px 0 0',
            borderTop: '2px solid rgba(16, 185, 129, 0.25)',
            fontSize: '16px',
            color: '#10b981',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✓</span> Route highlighted on map
        </div>
      )}
    </div>
  );
};

export const SearchResults: React.FC = () => {
  const { results, loading, error, origin, destination } = useSearchStore();
  const { selectedRoute, setSelectedRoute } = useSelectionStore();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '24px 32px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8',
          fontSize: '20px',
        }}
      >
        <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>🔄</span>
        Searching transit options…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '24px 32px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderTop: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171',
          fontSize: '20px',
        }}
      >
        {error}
      </div>
    );
  }

  if (!results || results.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(9, 13, 22, 0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '24px 32px 32px',
      }}
    >
      {/* Route label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {origin} → {destination}
        </span>
        <span
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            fontSize: '16px',
            fontWeight: 700,
            padding: '4px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {results.length} options
        </span>
      </div>

      {/* Horizontal scrollable cards (like Google Maps) */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
        }}
      >
        {results.map((journey: JourneyResult) => (
          <JourneyCard
            key={journey.journeyId}
            journey={journey}
            isSelected={
              !!selectedRoute &&
              journey.segments.some((s) => s.routeId === selectedRoute)
            }
            onSelect={() => {
              if (journey.segments[0]) {
                setSelectedRoute(journey.segments[0].routeId);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};
