import React, { useEffect, useState } from 'react';
import { useStaffAuthStore } from './state/auth';
import { useStaffIncidentStore } from './state/incident';
import { getStaffSession, logoutStaff } from './api/auth.api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Login } from './pages/Login';
import { Shift } from './pages/Shift';
import { Incident } from './pages/Incident';
import { FallbackPosition } from './pages/FallbackPosition';

type StaffTab = 'SHIFT' | 'INCIDENT' | 'FALLBACK';

export const App: React.FC = () => {
  const { isAuthenticated, user, setUser, logout } = useStaffAuthStore();
  const activeDraft = useStaffIncidentStore((s) => s.activeDraft);
  const [currentTab, setCurrentTab] = useState<StaffTab>('SHIFT');

  // Check HTTP-only session on load (Spec §4.3)
  useEffect(() => {
    let mounted = true;
    getStaffSession().then((sessionUser) => {
      if (mounted && sessionUser) {
        setUser(sessionUser);
      }
    });

    return () => {
      mounted = false;
    };
  }, [setUser]);

  const handleLogout = async () => {
    try {
      await logoutStaff();
    } finally {
      logout();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        maxWidth: '540px',
        margin: '0 auto',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
      }}
    >
      <ConnectionStatus hasPendingDraft={!!activeDraft} />

      {!isAuthenticated ? (
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Login />
        </main>
      ) : (
        <>
          {/* Mobile Operator Top Bar */}
          <header
            style={{
              padding: '12px 18px',
              background: '#0f172a',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                {user?.name || 'Driver Console'}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981' }}>
                {user?.staffId || 'ID: OP-704'} &bull; On Duty
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </header>

          {/* Tab Screen Content */}
          <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
            {currentTab === 'SHIFT' && <Shift />}
            {currentTab === 'INCIDENT' && <Incident />}
            {currentTab === 'FALLBACK' && <FallbackPosition />}
          </main>

          {/* Bottom Thumb Navigation */}
          <nav
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: '#090d16',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '8px 12px 16px',
            }}
          >
            {(
              [
                { id: 'SHIFT', label: 'Shift Duty', badge: false },
                { id: 'INCIDENT', label: 'Report Incident', badge: !!activeDraft },
                { id: 'FALLBACK', label: 'Fallback Mode', badge: false },
              ] as const
            ).map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id as StaffTab)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '8px 0',
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? '#10b981' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '20%',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                      }}
                    />
                  )}
                  {isActive && (
                    <span
                      style={{
                        width: '24px',
                        height: '2px',
                        borderRadius: '2px',
                        background: '#10b981',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
