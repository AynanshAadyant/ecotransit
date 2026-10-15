import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { searchLocation, LocationResult } from '../api/geocoding.api';
import { useLocationStore } from '../state/location';

const POPULAR_TIER2_SUGGESTIONS = [
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lon: 73.7125 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lon: 78.0322 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lon: 76.6394 },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245 },
];

interface LocationSearchProps {
  onCitySelected?: (cityName: string, lat: number, lon: number) => void;
  style?: React.CSSProperties;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({ onCitySelected, style }) => {
  const map = useMap();
  const setSelectedLocation = useLocationStore((s) => s.setSelectedLocation);
  const selectedLocation = useLocationStore((s) => s.selectedLocation);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const locations = await searchLocation(query);
      setResults(locations);
      setShowSuggestions(true);
    } catch (error) {
      console.error('[Geocoding error]', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (location: LocationResult | { name: string; lat: number; lon: number; state?: string }) => {
    const lat = 'latitude' in location ? location.latitude : location.lat;
    const lon = 'longitude' in location ? location.longitude : location.lon;
    const name = 'displayName' in location ? location.displayName.split(',')[0] : location.name;
    const fullName = 'displayName' in location ? location.displayName : `${location.name}, ${location.state}`;

    // Fly to searched city/location at zoom 13 per specification
    map.flyTo([lat, lon], 13, { duration: 1.8 });

    setSelectedLocation({
      name,
      displayName: fullName,
      latitude: lat,
      longitude: lon,
    });

    setQuery(name);
    setResults([]);
    setShowSuggestions(false);

    // Load local transit data (routes, stops, live buses) for this city
    onCitySelected?.(name, lat, lon);
  };

  const handleResetToIndia = () => {
    map.flyTo([22.9734, 78.6569], 5, { duration: 1.5 });
    useLocationStore.getState().clearSelectedLocation();
    setQuery('');
    setResults([]);
    setShowSuggestions(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        width: '380px',
        maxWidth: 'calc(100vw - 40px)',
        ...style,
      }}
    >
      {/* Search Input Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '6px 10px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <span style={{ fontSize: '15px', color: '#94a3b8', paddingLeft: '4px' }}>🔍</span>
        <input
          type="text"
          value={query}
          placeholder="Search city or location in India..."
          onChange={(e) => {
            setQuery(e.target.value);
            if (!showSuggestions) setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f8fafc',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
            }}
          >
            &times;
          </button>
        )}

        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            background: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {/* Selected Location Pill if active */}
      {selectedLocation && (
        <div
          style={{
            marginTop: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '11px',
            color: '#34d399',
            fontWeight: 600,
          }}
        >
          <span>📍 {selectedLocation.name}</span>
          <button
            onClick={handleResetToIndia}
            title="Reset to whole India overview"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '0 2px',
            }}
          >
            🇮🇳 Reset
          </button>
        </div>
      )}

      {/* Dropdown Results / Quick Suggestions */}
      {showSuggestions && (
        <div
          style={{
            marginTop: '8px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {/* Dynamic Search Results */}
          {results.length > 0 ? (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', padding: '4px 8px', fontWeight: 700 }}>
                Found Locations in India
              </div>
              {results.map((loc, idx) => (
                <button
                  key={`${loc.latitude}-${loc.longitude}-${idx}`}
                  onClick={() => selectLocation(loc)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>
                    {loc.displayName.split(',')[0]}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loc.displayName}
                  </span>
                </button>
              ))}
            </div>
          ) : query && !loading ? (
            <div style={{ padding: '8px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              Press Search or Enter to find location in India
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', padding: '4px 8px', fontWeight: 700 }}>
                Explore Tier-2 / Tier-3 Transit Cities
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {POPULAR_TIER2_SUGGESTIONS.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => selectLocation(city)}
                    style={{
                      textAlign: 'left',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                  >
                    <strong style={{ fontSize: '12px' }}>{city.name}</strong>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{city.state}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
