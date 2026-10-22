import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchStore } from '../state/search';
import { useSelectionStore } from '../state/selection';
import { searchJourney, searchStops } from '../api/transit.api';
import { RouteGeometry, Stop } from '@ecotransit/contracts';

export interface SearchPanelProps {
  routes?: RouteGeometry[];
  stops?: Stop[];
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ routes = [], stops = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    origin,
    destination,
    loading,
    setOrigin,
    setDestination,
    setResults,
    setLoading,
    setError,
    resetSearch,
  } = useSearchStore();

  const { selectedRoute, setSelectedRoute, clearSelection } = useSelectionStore();

  const [searchMode, setSearchMode] = useState<'route' | 'journey'>('route');

  // Route mode state
  const [routeQuery, setRouteQuery] = useState('');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Journey mode state
  const [originInput, setOriginInput] = useState(origin || '');
  const [destInput, setDestInput] = useState(destination || '');
  const [selectedOriginStop, setSelectedOriginStop] = useState<Stop | null>(null);
  const [selectedDestStop, setSelectedDestStop] = useState<Stop | null>(null);

  // Stop suggestions state
  const [activeStopField, setActiveStopField] = useState<'origin' | 'dest' | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<Stop[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Stop[]>([]);
  const [isSearchingStops, setIsSearchingStops] = useState(false);

  // Close dropdowns on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowRouteDropdown(false);
        setActiveStopField(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRouteDropdown(false);
        setActiveStopField(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter routes dynamically from registered system routes
  const filteredRoutes = useMemo(() => {
    if (!routeQuery.trim()) {
      return routes.slice(0, 8);
    }
    const q = routeQuery.toLowerCase().trim();
    return routes
      .filter(
        (r) =>
          r.routeId.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [routes, routeQuery]);

  const activeRouteObj = useMemo(() => {
    return selectedRoute ? routes.find((r) => r.routeId === selectedRoute) : null;
  }, [routes, selectedRoute]);

  // Dynamic Stop suggestions for Origin
  useEffect(() => {
    if (activeStopField !== 'origin') return;

    const query = originInput.trim().toLowerCase();
    if (query.length < 1) {
      // Use dynamically loaded stops
      setOriginSuggestions(stops.slice(0, 8));
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingStops(true);
      try {
        const remoteStops = await searchStops(query, 10);
        if (isMounted) {
          const localFiltered = stops.filter((s) => {
            const name = (s.displayName || s.stopName || s.name || '').toLowerCase();
            return name.includes(query);
          });

          const map = new Map<string, Stop>();
          for (const s of [...remoteStops, ...localFiltered]) {
            if (!map.has(s.stopId)) {
              map.set(s.stopId, s);
            }
          }
          setOriginSuggestions(Array.from(map.values()).slice(0, 10));
        }
      } catch {
        if (isMounted) {
          const fallback = stops.filter((s) => {
            const name = (s.displayName || s.stopName || s.name || '').toLowerCase();
            return name.includes(query);
          });
          setOriginSuggestions(fallback.slice(0, 10));
        }
      } finally {
        if (isMounted) setIsSearchingStops(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [originInput, activeStopField, stops]);

  // Dynamic Stop suggestions for Destination
  useEffect(() => {
    if (activeStopField !== 'dest') return;

    const query = destInput.trim().toLowerCase();
    if (query.length < 1) {
      setDestSuggestions(stops.slice(0, 8));
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingStops(true);
      try {
        const remoteStops = await searchStops(query, 10);
        if (isMounted) {
          const localFiltered = stops.filter((s) => {
            const name = (s.displayName || s.stopName || s.name || '').toLowerCase();
            return name.includes(query);
          });

          const map = new Map<string, Stop>();
          for (const s of [...remoteStops, ...localFiltered]) {
            if (!map.has(s.stopId)) {
              map.set(s.stopId, s);
            }
          }
          setDestSuggestions(Array.from(map.values()).slice(0, 10));
        }
      } catch {
        if (isMounted) {
          const fallback = stops.filter((s) => {
            const name = (s.displayName || s.stopName || s.name || '').toLowerCase();
            return name.includes(query);
          });
          setDestSuggestions(fallback.slice(0, 10));
        }
      } finally {
        if (isMounted) setIsSearchingStops(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [destInput, activeStopField, stops]);

  const handleSelectRoute = (routeId: string) => {
    setSelectedRoute(routeId);
    setShowRouteDropdown(false);
    setRouteQuery('');
  };

  const handleClearRoute = () => {
    setSelectedRoute(null);
    clearSelection();
    resetSearch();
  };

  const handleSelectOriginStop = (stop: Stop) => {
    const stopName = stop.displayName || stop.stopName || stop.name || stop.stopId;
    setOriginInput(stopName);
    setSelectedOriginStop(stop);
    setActiveStopField(null);
  };

  const handleSelectDestStop = (stop: Stop) => {
    const stopName = stop.displayName || stop.stopName || stop.name || stop.stopId;
    setDestInput(stopName);
    setSelectedDestStop(stop);
    setActiveStopField(null);
  };

  const handleJourneySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originInput.trim() || !destInput.trim()) return;

    setOrigin(originInput);
    setDestination(destInput);
    setLoading(true);
    setError(null);
    setActiveStopField(null);

    try {
      const results = await searchJourney(
        originInput,
        destInput,
        selectedOriginStop,
        selectedDestStop
      );
      setResults(results);

      // Auto-select the first route option to immediately draw corridor & reveal live buses
      if (results.length > 0 && results[0]?.segments[0]?.routeId) {
        setSelectedRoute(results[0].segments[0].routeId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to find journeys at this time.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const tmpInput = originInput;
    setOriginInput(destInput);
    setDestInput(tmpInput);

    const tmpStop = selectedOriginStop;
    setSelectedOriginStop(selectedDestStop);
    setSelectedDestStop(tmpStop);
  };

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '820px' }}
    >
      {/* Top Mode Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setSearchMode('route');
              setActiveStopField(null);
            }}
            style={{
              padding: '5px 14px',
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
            onClick={() => {
              setSearchMode('journey');
              setShowRouteDropdown(false);
            }}
            style={{
              padding: '5px 14px',
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

      {/* Main Search Bar: Route Mode */}
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
                setShowRouteDropdown(true);
              }}
              onFocus={() => setShowRouteDropdown(true)}
              placeholder="Search route name or number..."
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
                  setShowRouteDropdown(false);
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

          {/* Dynamic Autocomplete Dropdown for Routes */}
          {showRouteDropdown && (
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
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  padding: '4px 8px 6px',
                  letterSpacing: '0.05em',
                }}
              >
                {routeQuery.trim() ? 'Matching Routes' : 'Available Routes'}
              </div>

              {filteredRoutes.length === 0 ? (
                <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                  No transit routes found matching "{routeQuery}".
                </div>
              ) : (
                filteredRoutes.map((r) => (
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
                ))
              )}
            </div>
          )}

          {/* Dynamic Route Chips from available network routes */}
          {routes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', overflowX: 'auto' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Routes:
              </span>
              {routes.slice(0, 6).map((r) => (
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
          )}
        </div>
      ) : (
        /* Journey Mode: Origin to Destination with Live Dynamic Autocomplete */
        <div style={{ position: 'relative', width: '100%' }}>
          <form
            onSubmit={handleJourneySearch}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(18px)',
              border: `1px solid ${loading ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.14)'}`,
              borderRadius: '12px',
              boxShadow: loading
                ? '0 8px 32px rgba(16, 185, 129, 0.25)'
                : '0 8px 32px rgba(0,0,0,0.45)',
              padding: '6px 12px',
              width: '100%',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            {/* Origin Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                gap: '8px',
                padding: '4px 8px',
                position: 'relative',
                opacity: loading ? 0.65 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>📍</span>
              <input
                id="search-origin"
                type="text"
                disabled={loading}
                value={originInput}
                onChange={(e) => {
                  setOriginInput(e.target.value);
                  setSelectedOriginStop(null);
                  setActiveStopField('origin');
                }}
                onFocus={() => {
                  if (!loading) setActiveStopField('origin');
                }}
                placeholder="From station..."
                autoComplete="off"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '15px',
                  fontWeight: 500,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: loading ? 'wait' : 'text',
                }}
              />
              {originInput && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setOriginInput('');
                    setSelectedOriginStop(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

            {/* Swap Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleSwap}
              title={loading ? 'Searching in progress...' : 'Swap stations'}
              style={{
                background: 'transparent',
                border: 'none',
                color: loading ? '#475569' : '#64748b',
                fontSize: '18px',
                cursor: loading ? 'wait' : 'pointer',
                padding: '4px 8px',
                flexShrink: 0,
                opacity: loading ? 0.5 : 1,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.color = '#10b981';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.color = '#64748b';
              }}
            >
              ⇆
            </button>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

            {/* Destination Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                gap: '8px',
                padding: '4px 8px',
                position: 'relative',
                opacity: loading ? 0.65 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>🏁</span>
              <input
                id="search-destination"
                type="text"
                disabled={loading}
                value={destInput}
                onChange={(e) => {
                  setDestInput(e.target.value);
                  setSelectedDestStop(null);
                  setActiveStopField('dest');
                }}
                onFocus={() => {
                  if (!loading) setActiveStopField('dest');
                }}
                placeholder="To station..."
                autoComplete="off"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '15px',
                  fontWeight: 500,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: loading ? 'wait' : 'text',
                }}
              />
              {destInput && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setDestInput('');
                    setSelectedDestStop(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Submit Button */}
            <button
              id="search-submit"
              type="submit"
              disabled={loading || !originInput.trim() || !destInput.trim()}
              style={{
                background: loading
                  ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                padding: '8px 16px',
                cursor: loading ? 'wait' : !originInput.trim() || !destInput.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                opacity: !originInput.trim() || !destInput.trim() ? 0.4 : 1,
                boxShadow: loading ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.75s linear infinite',
                    }}
                  />
                  <span>Finding Route...</span>
                </>
              ) : (
                'Find Route'
              )}
            </button>

            {/* Hold State Shimmer Progress Line */}
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #059669, #34d399, #38bdf8, #059669)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite linear',
                }}
              />
            )}
          </form>

          {/* Hold State Active Backend Call Visualizer */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '6px 12px',
                marginTop: '6px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 500,
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    border: '2px solid rgba(52, 211, 153, 0.3)',
                    borderTopColor: '#34d399',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>Connecting to transit graph • Matching corridor routes across station clusters...</span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: '#6ee7b7',
                  background: 'rgba(16, 185, 129, 0.2)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  letterSpacing: '0.02em',
                }}
              >
                HOLD STATE
              </span>
            </div>
          )}

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.65; }
            }
          `}</style>

          {/* Dynamic Dropdown for Origin Stop */}
          {activeStopField === 'origin' && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '50%',
                minWidth: '280px',
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '10px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                zIndex: 2000,
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  padding: '4px 8px 6px',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{originInput.trim() ? 'Matching Stations' : 'Nearby Stations'}</span>
                {isSearchingStops && <span style={{ color: '#10b981' }}>Searching…</span>}
              </div>

              {originSuggestions.length === 0 ? (
                <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                  {originInput.trim()
                    ? `No stations found for "${originInput}".`
                    : 'Type station name to search...'}
                </div>
              ) : (
                originSuggestions.map((s) => {
                  const displayName = s.displayName || s.stopName || s.name || s.stopId;
                  return (
                    <div
                      key={s.stopId}
                      onClick={() => handleSelectOriginStop(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🚏</span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                          {displayName}
                        </span>
                      </div>
                      {s.clusterId && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#94a3b8',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {s.clusterId}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Dynamic Dropdown for Destination Stop */}
          {activeStopField === 'dest' && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '50%',
                minWidth: '280px',
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '10px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                zIndex: 2000,
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  padding: '4px 8px 6px',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{destInput.trim() ? 'Matching Stations' : 'Nearby Stations'}</span>
                {isSearchingStops && <span style={{ color: '#10b981' }}>Searching…</span>}
              </div>

              {destSuggestions.length === 0 ? (
                <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                  {destInput.trim()
                    ? `No stations found for "${destInput}".`
                    : 'Type station name to search...'}
                </div>
              ) : (
                destSuggestions.map((s) => {
                  const displayName = s.displayName || s.stopName || s.name || s.stopId;
                  return (
                    <div
                      key={s.stopId}
                      onClick={() => handleSelectDestStop(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🏁</span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                          {displayName}
                        </span>
                      </div>
                      {s.clusterId && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#94a3b8',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {s.clusterId}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
