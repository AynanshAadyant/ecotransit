import React, { useEffect, useState } from 'react';
import { useAdminAuthStore } from './state/auth';
import { useFleetStore } from './state/fleet';
import { useIncidentStore } from './state/incidents';
import { useReportsStore } from './state/reports';
import { getFleetSnapshot, getAdminRoutes, getAdminStops } from './api/fleet.api';
import { getIncidents, acknowledgeIncident, resolveIncident } from './api/incidents.api';
import { getStaffRoster, reassignShift } from './api/staff.api';
import { getOperationalSummary, getHeadwayVariance } from './api/reports.api';
import { RouteGeometry, Stop, Shift, IncidentStatus } from '@ecotransit/contracts';
import { AdminHeader, AdminTab } from './components/AdminHeader';
import { FleetMapView } from './fleet/FleetMapView';
import { FleetMatrix } from './fleet/FleetMatrix';
import { IncidentQueue } from './incidents/IncidentQueue';
import { IncidentDetail } from './incidents/IncidentDetail';
import { StaffAdmin } from './staff/StaffAdmin';
import { ReportsView } from './reports/ReportsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('FLEET');
  const [routes, setRoutes] = useState<RouteGeometry[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Stores
  const adminUser = useAdminAuthStore((s) => s.adminUser);
  const vehicles = useFleetStore((s) => s.vehicles);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const selectedRouteId = useFleetStore((s) => s.selectedRouteId);
  const setVehicles = useFleetStore((s) => s.setVehicles);
  const setSelectedVehicleId = useFleetStore((s) => s.setSelectedVehicleId);
  const setSelectedRouteId = useFleetStore((s) => s.setSelectedRouteId);

  const incidents = useIncidentStore((s) => s.incidents);
  const selectedIncidentId = useIncidentStore((s) => s.selectedIncidentId);
  const setIncidents = useIncidentStore((s) => s.setIncidents);
  const setSelectedIncidentId = useIncidentStore((s) => s.setSelectedIncidentId);
  const applyTransition = useIncidentStore((s) => s.applyTransition);

  const summary = useReportsStore((s) => s.summary);
  const headwayMetrics = useReportsStore((s) => s.headwayMetrics);
  const setSummary = useReportsStore((s) => s.setSummary);
  const setHeadwayMetrics = useReportsStore((s) => s.setHeadwayMetrics);

  const selectedIncident = incidents.find((i) => i.incidentId === selectedIncidentId) || null;
  const openIncidentsCount = incidents.filter((i) => i.status === 'OPEN').length;

  // Initial data loading (Spec §1.1: real data only - fail cleanly with empty state if offline)
  useEffect(() => {
    let mounted = true;

    // Load fleet & network
    Promise.allSettled([getFleetSnapshot(), getAdminRoutes(), getAdminStops()]).then(
      ([vehRes, routeRes, stopRes]) => {
        if (!mounted) return;
        if (vehRes.status === 'fulfilled') {
          const dict = vehRes.value.reduce<Record<string, (typeof vehRes.value)[0]>>((acc, v) => {
            acc[v.vehicleId] = v;
            return acc;
          }, {});
          setVehicles(dict);
        }
        if (routeRes.status === 'fulfilled') setRoutes(routeRes.value);
        if (stopRes.status === 'fulfilled') setStops(stopRes.value);
      }
    );

    // Load incidents
    getIncidents()
      .then((data) => {
        if (mounted) setIncidents(data);
      })
      .catch(() => {
        // Offline / not reachable
      });

    // Load staff roster
    getStaffRoster()
      .then((data) => {
        if (mounted) setShifts(data);
      })
      .catch(() => {});

    // Load operational reports
    Promise.allSettled([getOperationalSummary(), getHeadwayVariance()]).then(
      ([summaryRes, headwayRes]) => {
        if (!mounted) return;
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (headwayRes.status === 'fulfilled') setHeadwayMetrics(headwayRes.value);
      }
    );

    return () => {
      mounted = false;
    };
  }, [setVehicles, setIncidents, setSummary, setHeadwayMetrics]);

  // Guarded transition handler (Spec §3.3)
  const handleTransition = async (
    incidentId: string,
    nextStatus: IncidentStatus,
    notes?: string
  ) => {
    const success = applyTransition(incidentId, nextStatus, notes);
    if (!success) return;

    try {
      if (nextStatus === 'ACKNOWLEDGED') {
        await acknowledgeIncident(incidentId);
      } else if (nextStatus === 'RESOLVED') {
        await resolveIncident(incidentId, notes || '');
      }
    } catch {
      console.warn('[Admin Service] Server sync failed; state machine transition queued locally.');
    }
  };

  const handleReassignShift = async (shiftId: string, vehicleId: string, routeId: string) => {
    try {
      const updated = await reassignShift(shiftId, vehicleId, routeId);
      setShifts((prev) => prev.map((s) => (s.shiftId === shiftId ? updated : s)));
    } catch {
      setShifts((prev) =>
        prev.map((s) =>
          s.shiftId === shiftId
            ? { ...s, assignedVehicleId: vehicleId, assignedRouteId: routeId }
            : s
        )
      );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <AdminHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openIncidentsCount={openIncidentsCount}
        userName={adminUser?.name}
        userRole={adminUser?.role}
      />

      <main style={{ flex: 1, overflow: 'hidden', padding: '16px', position: 'relative' }}>
        {/* Module 1: Fleet Supervision */}
        {activeTab === 'FLEET' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', height: '100%' }}>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
              <FleetMapView
                vehicles={vehicles}
                routes={routes}
                stops={stops}
                selectedVehicleId={selectedVehicleId}
                selectedRouteId={selectedRouteId}
                onSelectVehicle={setSelectedVehicleId}
                onSelectRoute={setSelectedRouteId}
              />
            </div>
            <FleetMatrix
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
        )}

        {/* Module 2: Incident Management (Guarded state machine) */}
        {activeTab === 'INCIDENTS' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedIncident ? '1.4fr 1fr' : '1fr', gap: '16px', height: '100%' }}>
            <IncidentQueue
              incidents={incidents}
              onTransition={handleTransition}
              onSelectIncident={(inc) => setSelectedIncidentId(inc.incidentId)}
              selectedIncidentId={selectedIncidentId}
            />
            {selectedIncident && (
              <IncidentDetail
                incident={selectedIncident}
                onClose={() => setSelectedIncidentId(null)}
              />
            )}
          </div>
        )}

        {/* Module 3: Staff Administration */}
        {activeTab === 'STAFF' && (
          <StaffAdmin shifts={shifts} onReassign={handleReassignShift} />
        )}

        {/* Module 4: Operational Reporting */}
        {activeTab === 'REPORTS' && (
          <ReportsView summary={summary} headwayMetrics={headwayMetrics} />
        )}
      </main>
    </div>
  );
};

export default App;
