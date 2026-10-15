import React, { useState } from 'react';
import { useSearchStore } from '../state/search';
import { searchJourney } from '../api/transit.api';

export const SearchPanel: React.FC = () => {
  const { origin, destination, loading, setOrigin, setDestination, setResults, setLoading, setError } =
    useSearchStore();

  const [originInput, setOriginInput] = useState(origin || '');
  const [destInput, setDestInput] = useState(destination || '');

  const handleSearch = async (e: React.FormEvent) => {
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
    <form
      onSubmit={handleSearch}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.13)',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        padding: '12px 16px',
        width: '100%',
        maxWidth: '800px',
      }}
    >
      {/* From */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px', padding: '8px 16px' }}>
        <span style={{ fontSize: '24px', flexShrink: 0 }}>📍</span>
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
            fontSize: '20px',
            fontWeight: 500,
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

      {/* Swap */}
      <button
        type="button"
        onClick={handleSwap}
        title="Swap origin and destination"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '8px 12px',
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#10b981')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
      >
        ⇆
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

      {/* To */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px', padding: '8px 16px' }}>
        <span style={{ fontSize: '24px', flexShrink: 0 }}>🏁</span>
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
            fontSize: '20px',
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
          borderRadius: '12px',
          color: '#fff',
          fontWeight: 700,
          fontSize: '20px',
          padding: '16px 32px',
          cursor: loading ? 'default' : 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          letterSpacing: '0.02em',
          opacity: !originInput.trim() || !destInput.trim() ? 0.4 : 1,
        }}
      >
        {loading ? '…' : 'Search'}
      </button>
    </form>
  );
};
