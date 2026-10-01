import React, { useState } from 'react';

interface LegendItem {
  label: string;
  color: string;
}

interface LegendProps {
  items: LegendItem[];
}

export const Legend: React.FC<LegendProps> = ({ items }) => {
  const [expanded, setExpanded] = useState(false);

  const metroItems = items.filter((i) => i.label.toLowerCase().includes('line') || i.label.toLowerCase().includes('metro') || i.label.toLowerCase().includes('dtc') === false);
  const busItems = items.filter((i) => i.label.toLowerCase().includes('dtc'));

  return (
    <div
      style={{
        background: 'rgba(9, 13, 22, 0.92)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: '16px',
        color: '#94a3b8',
        maxWidth: '480px',
        overflow: 'hidden',
      }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          width: '100%',
          padding: '12px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#e2e8f0',
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span>🗺 Live Routes ({items.length})</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>{expanded ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {expanded && (
        <div
          style={{
            maxHeight: '240px',
            overflowY: 'auto',
            padding: '0 12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Metro section */}
          {metroItems.length > 0 && (
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#38bdf8', marginBottom: '8px' }}>🚇 Metro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {metroItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ flexShrink: 0, width: '20px', height: '4px', borderRadius: '2px', backgroundColor: item.color }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '16px' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bus section */}
          {busItems.length > 0 && (
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#10b981', marginBottom: '8px', marginTop: '12px' }}>🚌 DTC City Buses</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {busItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ flexShrink: 0, width: '20px', height: '4px', borderRadius: '2px', backgroundColor: item.color }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '16px' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
