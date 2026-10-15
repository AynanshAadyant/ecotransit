import React from 'react';
import { ShieldIcon } from 'lucide-react';
import { Badge } from '@ecotransit/ui';

export type AdminTab = 'FLEET' | 'INCIDENTS' | 'STAFF' | 'REPORTS';

interface AdminHeaderProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  openIncidentsCount?: number;
  userName?: string;
  userRole?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  onTabChange,
  openIncidentsCount = 0,
  userName = 'Transit Controller',
  userRole = 'FLEET_SUPERVISOR',
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: '#090d16',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <ShieldIcon size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              EcoTransit Command Center
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Operations & Supervision</span>
          </div>
        </div>

        {/* Navigation Tabs for the 4 Core Modules */}
        <nav style={{ display: 'flex', gap: '4px' }}>
          {(
            [
              { id: 'FLEET', label: 'Fleet Supervision' },
              { id: 'INCIDENTS', label: 'Incident Queue', count: openIncidentsCount },
              { id: 'STAFF', label: 'Staff Administration' },
              { id: 'REPORTS', label: 'Operational Reporting' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as AdminTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{userName}</div>
          <Badge label={userRole} status="default" size="sm" />
        </div>
      </div>
    </header>
  );
};
