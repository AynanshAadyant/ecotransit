import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus,
  Clock,
  AlertTriangle,
  Play,
  StopCircle,
  PlusCircle,
  CheckCircle2,
  Activity,
  ArrowRight,
  Loader2,
  Navigation,
} from 'lucide-react';
import { useStaffPortalStore } from '../../state/staffPortal.store';
import { useAuthStore } from '../../state/auth.store';

export default function StaffDashboard() {
  const { user } = useAuthStore();
  const { dashboardData, activeTrip, loading, error, loadDashboard, endTrip } = useStaffPortalStore();

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-72">
        <Loader2 className="w-9 h-9 text-emerald-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Synchronizing staff operations...</p>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700">
        <h3 className="font-semibold text-base mb-1">Operational Sync Failure</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => loadDashboard()}
          className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Shift Control Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Operator Station
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Hello, {user?.name || 'Staff Member'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Monitor active transit trips, execute shift changes, and report real-time route disruptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTrip ? (
              <div className="flex items-center gap-3 bg-emerald-900/60 border border-emerald-500/40 p-3 rounded-xl backdrop-blur-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    Active Trip #{activeTrip.id}
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Navigation className="w-4 h-4 text-emerald-400" />
                    {activeTrip.vehicleNumber} • {activeTrip.routeName || 'Assigned Route'}
                  </div>
                </div>
                <button
                  onClick={() => endTrip(activeTrip.id, 'Shift concluded from dashboard')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md"
                >
                  <StopCircle className="w-4 h-4" />
                  End Shift
                </button>
              </div>
            ) : (
              <Link
                to="/staff/shift"
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Start Shift / Trip
              </Link>
            )}

            <Link
              to="/staff/incidents/report"
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              Report Incident
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              activeTrip ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Current Shift Status</p>
            <p className="text-lg font-bold text-slate-800">
              {activeTrip ? 'On Duty' : 'Off Shift'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Assigned Vehicles</p>
            <p className="text-lg font-bold text-slate-800">
              {dashboardData?.assignedVehicles?.length ?? 0} Unit(s)
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Incidents</p>
            <p className="text-lg font-bold text-slate-800">
              {dashboardData?.openIncidents?.length ?? 0} Open
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Fleet Active Trips</p>
            <p className="text-lg font-bold text-slate-800">
              {dashboardData?.activeTrips?.length ?? 0} Live
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Vehicles & Active Trips (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Vehicles */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Assigned Fleet Vehicles</h3>
                <p className="text-xs text-slate-500">Vehicles currently scheduled or designated for your duties</p>
              </div>
              <Link
                to="/staff/shift"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Shift Console <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-5">
              {!dashboardData?.assignedVehicles || dashboardData.assignedVehicles.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Bus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No scheduled vehicles assigned</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You can pick an available operational vehicle from the shift page to commence duty.
                  </p>
                  <Link
                    to="/staff/shift"
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    Select Vehicle & Start
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {dashboardData.assignedVehicles.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-base">{v.vehicleNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              v.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Plate: {v.registrationNumber}</p>
                        <p className="text-xs font-medium text-slate-700 mt-2 flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-slate-400" />
                          {v.routeName || 'Assigned Corridor'} ({v.routeCode || 'RTE'})
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Unit ID: #{v.id}</span>
                        <Link
                          to="/staff/shift"
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          Deploy Shift →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Fleet on Network */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Network Live Trips</h3>
                <p className="text-xs text-slate-500">Real-time journeys operating across active sectors</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {!dashboardData?.activeTrips || dashboardData.activeTrips.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No active transit trips currently registered on the network.
                </div>
              ) : (
                dashboardData.activeTrips.map((trip) => (
                  <div key={trip.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        {trip.routeCode || 'RT'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {trip.vehicleNumber || `Vehicle #${trip.vehicleId}`} — {trip.routeName || 'Transit Route'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Started: {new Date(trip.startTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Operating
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Open Incidents & Activity Feed */}
        <div className="space-y-6">
          {/* Open Incidents Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-800">Disruption Alerts</h3>
              </div>
              <Link
                to="/staff/incidents"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View All
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {!dashboardData?.openIncidents || dashboardData.openIncidents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-1" />
                  No open disruptions. Corridor clear.
                </div>
              ) : (
                dashboardData.openIncidents.slice(0, 5).map((inc) => (
                  <div key={inc.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {inc.type.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          inc.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : inc.severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{inc.description}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {inc.vehicleNumber ? `${inc.vehicleNumber} • ` : ''}
                      {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Recent Operations</h3>
            </div>
            <div className="p-4 space-y-3">
              {!dashboardData?.recentActivity || dashboardData.recentActivity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No logged activity in current cycle.</p>
              ) : (
                dashboardData.recentActivity.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0"></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 font-medium">{item.summary}</p>
                      <p className="text-slate-400 text-[10px]">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
