import React from 'react';
import { BusIcon, WifiIcon, WifiOffIcon } from '@ecotransit/ui';

interface HeaderProps {
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  systemName?: string;
}

/**
 * Presentational component only:
 * No data fetching, no store access, props only.
 */
export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  systemName = 'EcoTransit Metro Portal',
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 48px',
        background: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 30,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
          }}
        >
          <BusIcon style={{ width: '40px', height: '40px' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '36px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {systemName}
          </h1>
          <span style={{ fontSize: '18px', color: '#64748b' }}>
            Zero-Emission Urban Mobility Network
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 20px',
            borderRadius: '30px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '20px',
          }}
        >
          {connectionStatus === 'connected' ? (
            <>
              <WifiIcon style={{ width: '14px', height: '14px', color: '#10b981' }} />
              <span style={{ color: '#34d399', fontWeight: 500 }}>Live Telemetry</span>
            </>
          ) : connectionStatus === 'reconnecting' ? (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
              <span style={{ color: '#38bdf8', fontWeight: 500 }}>Reconnecting</span>
            </>
          ) : (
            <>
              <WifiOffIcon style={{ width: '14px', height: '14px', color: '#f87171' }} />
              <span style={{ color: '#f87171', fontWeight: 500 }}>Disconnected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
