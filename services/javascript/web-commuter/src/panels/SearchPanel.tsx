import React, { useState, useMemo } from 'react';
import { useSearchStore } from '../state/search';
import { useSelectionStore } from '../state/selection';
import { searchJourney } from '../api/transit.api';
import { RouteGeometry } from '@ecotransit/contracts';

export interface SearchPanelProps {
  routes?: RouteGeometry[];
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ routes = [] }) => {
  const { origin, destination, loading, setOrigin, setDestination, setResults, setLoading, setError, resetSearch } =
    useSearchStore();
  const { selectedRoute, setSelectedRoute, clearSelection } = useSelectionStore();

  const [searchMode, setSearchMode] = useState<'route' | 'journey'>('route');
  const [routeQuery, setRouteQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [originInput, setOriginInput] = useState(origin || '');
  const [destInput, setDestInput] = useState(destination || '');

  // Filter routes matching user input
  const filteredRoutes = useMemo(() => {
    if (!routeQuery.trim()) return [];
    const q = routeQuery.toLowerCase().trim();
    return routes.filter(
      (r) =>
        r.routeId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [routes, routeQuery]);

  const activeRouteObj = useMemo(() => {
    return selectedRoute ? routes.find((r) => r.routeId === selectedRoute) : null;
  }, [routes, selectedRoute]);

  const handleSelectRoute = (routeId: string) => {
    setSelectedRoute(routeId);
    setShowDropdown(false);
    setRouteQuery('');
  };

  const handleClearRoute = () => {
    setSelectedRoute(null);
    clearSelection();
    resetSearch();
  };

  const handleJourneySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originInput.trim() || !destInput.trim()) return;

    setOrigin(originInput);
    setDestination(destInput);
    setLoading(true);
    setError(null);

    try {
      const results = await searchJourney(originInput, destInput);
      setResults(results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to find journeys at this time.';
      setError(message);
    }
  };

  const handleSwap = () => {
    const tmp = originInput;
    setOriginInput(destInput);
    setDestInput(tmp);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '820px' }}>
      {/* Top Mode Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setSearchMode('route')}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: searchMode === 'route' ? '#10b981' : 'rgba(255,255,255,0.08)',
              color: searchMode === 'route' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            🚌 Search Route
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('journey')}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: searchMode === 'journey' ? '#10b981' : 'rgba(255,255,255,0.08)',
              color: searchMode === 'journey' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            🧭 Station Journey
          </button>
        </div>

        {/* Active Route Indicator & Clear */}
        {activeRouteObj && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ color: activeRouteObj.color || '#10b981' }}>●</span>
              <b>{activeRouteObj.name}</b>
            </span>
            <button
              type="button"
              onClick={handleClearRoute}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Search Bar */}
      {searchMode === 'route' ? (
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              padding: '6px 14px',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '18px', flexShrink: 0 }}>🔍</span>
            <input
              type="text"
              value={routeQuery}
              onChange={(e) => {
                setRouteQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search Delhi route or bus number (e.g. 521, Yellow Line, 615, DL-M1)..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '15px',
                fontWeight: 500,
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
            {routeQuery && (
              <button
                type="button"
                onClick={() => {
                  setRouteQuery('');
                  setShowDropdown(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && filteredRoutes.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '10px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                zIndex: 2000,
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '4px',
              }}
            >
              {filteredRoutes.map((r) => (
                <div
                  key={r.routeId}
                  onClick={() => handleSelectRoute(r.routeId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: r.color || '#38bdf8', fontSize: '14px' }}>●</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>{r.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {r.routeId}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Route Selection Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', overflowX: 'auto' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Popular:
            </span>
            {routes.slice(0, 5).map((r) => (
              <button
                key={r.routeId}
                type="button"
                onClick={() => handleSelectRoute(r.routeId)}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${selectedRoute === r.routeId ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                  background: selectedRoute === r.routeId ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                  color: selectedRoute === r.routeId ? '#34d399' : '#cbd5e1',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                }}
              >
                <span style={{ color: r.color || '#38bdf8', marginRight: '4px' }}>●</span>
                {r.name.split('(')[0]?.trim()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleJourneySearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            padding: '6px 12px',
            width: '100%',
          }}
        >
          {/* From */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px', padding: '4px 8px' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>📍</span>
            <input
              id="search-origin"
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="From station…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '15px',
                fontWeight: 500,
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          {/* Swap */}
          <button
            type="button"
            onClick={handleSwap}
            title="Swap stations"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              flexShrink: 0,
            }}
          >
            ⇆
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          {/* To */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px', padding: '4px 8px' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>🏁</span>
            <input
              id="search-destination"
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              placeholder="To station…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '15px',
                fontWeight: 500,
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Search button */}
          <button
            id="search-submit"
            type="submit"
            disabled={loading || !originInput.trim() || !destInput.trim()}
            style={{
              background: loading ? '#0e4f3a' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              padding: '8px 16px',
              cursor: loading ? 'default' : 'pointer',
              flexShrink: 0,
              opacity: !originInput.trim() || !destInput.trim() ? 0.4 : 1,
            }}
          >
            {loading ? '…' : 'Find Route'}
          </button>
        </form>
      )}
    </div>
  );
};
