import React, { useEffect, useState } from 'react';
import { WifiIcon, WifiOffIcon } from '@ecotransit/ui';

interface ConnectionStatusProps {
  hasPendingDraft?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ hasPendingDraft = false }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)',
        borderBottom: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.3)'}`,
        fontSize: '11px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isOnline ? (
          <>
            <WifiIcon style={{ width: '13px', height: '13px', color: '#10b981' }} />
            <span style={{ color: '#34d399', fontWeight: 600 }}>Cellular Network Online</span>
          </>
        ) : (
          <>
            <WifiOffIcon style={{ width: '13px', height: '13px', color: '#f87171' }} />
            <span style={{ color: '#f87171', fontWeight: 600 }}>Connection Offline — Local Draft Active</span>
          </>
        )}
      </div>

      {hasPendingDraft && (
        <span
          style={{
            background: '#f59e0b',
            color: '#090d16',
            fontWeight: 700,
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '4px',
          }}
        >
          Draft Saved
        </span>
      )}
    </div>
  );
};
