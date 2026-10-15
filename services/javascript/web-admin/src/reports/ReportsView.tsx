import React from 'react';
import { OperationalReport, HeadwayMetric } from '../api/reports.api';

interface ReportsViewProps {
  summary: OperationalReport | null;
  headwayMetrics: HeadwayMetric[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ summary, headwayMetrics }) => {
  const defaultSummary: OperationalReport = summary || {
    totalTripsCompleted: 1420,
    onTimePunctualityRate: 94.6,
    fleetActivePercent: 88.2,
    totalPassengersServed: 38450,
    emissionSavingsKg: 6420,
    averageDelaySeconds: 42,
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '24px',
        gap: '24px',
        overflowY: 'auto',
      }}
    >
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
          Operational Performance & Sustainability Reporting
        </h2>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Real-time service reliability indices and decarbonization impact
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
            On-Time Punctuality
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', margin: '4px 0' }}>
            {defaultSummary.onTimePunctualityRate}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Target SLA: 92.0%</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
            Fleet Utilization
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8', margin: '4px 0' }}>
            {defaultSummary.fleetActivePercent}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Active in-service units</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
            CO₂ Avoided
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#34d399', margin: '4px 0' }}>
            {defaultSummary.emissionSavingsKg.toLocaleString()} kg
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Green electric corridor savings</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
            Avg Route Delay
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b', margin: '4px 0' }}>
            {defaultSummary.averageDelaySeconds}s
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Mean variance across stops</div>
        </div>
      </div>

      {/* Headway Variance Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          Route Headway Regularity
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {headwayMetrics.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              Headway variance observations compiling from active fleet tracking...
            </div>
          ) : (
            headwayMetrics.map((metric) => {
              const variancePct = Math.min(100, Math.abs(metric.varianceSeconds) / (metric.targetHeadwaySeconds / 100));
              const isHighVariance = metric.varianceSeconds > 120;

              return (
                <div
                  key={metric.routeId}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                      {metric.routeName} ({metric.routeId})
                    </span>
                    <span style={{ fontSize: '12px', color: isHighVariance ? '#f87171' : '#34d399' }}>
                      Variance: {metric.varianceSeconds > 0 ? `+${metric.varianceSeconds}s` : `${metric.varianceSeconds}s`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#94a3b8' }}>
                    <span>Target: {metric.targetHeadwaySeconds / 60}m</span>
                    <span>Actual: {(metric.actualHeadwaySeconds / 60).toFixed(1)}m</span>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${variancePct}%`,
                          height: '100%',
                          background: isHighVariance ? '#ef4444' : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
