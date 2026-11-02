import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Bus,
  Map,
  AlertTriangle,
  Loader2,
  Radio,
  Wifi,
  WifiOff,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useDashboardStore } from '../state/dashboard.store';

export default function Dashboard() {
  const {
    data,
    loading,
    error,
    wsConnected,
    connectionMode,
    lastTelemetryTime,
    recentLiveEvents,
    startLiveStream,
    stopLiveStream,
  } = useDashboardStore();

  useEffect(() => {
    startLiveStream();
    return () => {
      stopLiveStream();
    };
  }, [startLiveStream, stopLiveStream]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-72">
        <Loader2 className="w-9 h-9 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Connecting to transit operations telemetry...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 max-w-xl mx-auto">
        <h3 className="font-bold text-base mb-1">Telemetry Initialization Error</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => startLiveStream()}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const activeVehiclesCount = data?.fleetStatus?.active ?? data?.activeVehicles ?? 0;
  const maintenanceCount = data?.fleetStatus?.maintenance ?? 0;
  const offlineCount = data?.fleetStatus?.offline ?? data?.offlineDevices ?? 0;
  const totalVehiclesCount = data?.totalVehicles ?? 0;

  const activePercent = totalVehiclesCount > 0 ? (activeVehiclesCount / totalVehiclesCount) * 100 : 0;
  const maintenancePercent = totalVehiclesCount > 0 ? (maintenanceCount / totalVehiclesCount) * 100 : 0;
  const offlinePercent = totalVehiclesCount > 0 ? (offlineCount / totalVehiclesCount) * 100 : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Real-time Connection Indicator */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold tracking-wider text-indigo-300 uppercase">
              Control Station Operations
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">EcoTransit Dispatch Matrix</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time fleet telemetry, active route segments, and automated incident monitoring.
          </p>
        </div>

        {/* Connection Status Pill */}
        <div className="flex flex-col items-start sm:items-end gap-1.5 self-start sm:self-auto">
          <div
            className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md transition-all ${
              connectionMode === 'websocket'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : connectionMode === 'polling'
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {connectionMode === 'websocket' ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" />
                  WebSocket Stream Live
                </span>
              </>
            ) : connectionMode === 'polling' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  HTTP Fallback Polling (10s)
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Telemetry Standby</span>
              </>
            )}
          </div>

          {lastTelemetryTime && (
            <span className="text-[11px] font-mono text-slate-400">
              Heartbeat: {lastTelemetryTime}
            </span>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Fleet</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalVehiclesCount}</span>
            <span className="text-xs text-slate-400">Registered</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span className="text-emerald-600 font-semibold">{activeVehiclesCount}</span> active on line
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Corridors</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Map className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.activeRoutes ?? 12}</span>
            <span className="text-xs text-slate-400">Topologies</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span className="text-emerald-600 font-semibold">{data?.activeTrips ?? 0}</span> scheduled trips
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operations Staff</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.totalStaff ?? 0}</span>
            <span className="text-xs text-slate-400">Operators</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            Verified dispatch access
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Incident Queue</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.openIncidents ?? 0}</span>
            <span className="text-xs text-slate-400">Actionable</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <Link to="/admin/incidents" className="text-rose-600 font-semibold hover:underline">
              Inspect dispatch queue →
            </Link>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Fleet Matrix & Live Stream (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fleet Status Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-800">Fleet Operational Matrix</h3>
                <p className="text-xs text-slate-500">Live operational state across public transit units</p>
              </div>
              <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                {totalVehiclesCount} TOTAL
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    On Route & Operational
                  </span>
                  <span className="text-emerald-700 font-bold">
                    {activeVehiclesCount} Units ({activePercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, activePercent)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Depot Maintenance / Inspection
                  </span>
                  <span className="text-amber-700 font-bold">
                    {maintenanceCount} Units ({maintenancePercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, maintenancePercent)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Offline / Standby / Depot
                  </span>
                  <span className="text-slate-700 font-bold">
                    {offlineCount} Units ({offlinePercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-slate-400 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, offlinePercent)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry & Event Stream */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">Live Telemetry & Socket Stream</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {wsConnected ? 'Listening for socket broadcast' : 'Awaiting socket link'}
              </span>
            </div>

            <div className="p-4">
              {recentLiveEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <Radio className="w-7 h-7 mx-auto mb-2 text-slate-300 animate-pulse" />
                  Streaming channel initialized. Events will append automatically as vehicles broadcast pings.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentLiveEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            evt.type === 'telemetry'
                              ? 'bg-emerald-500'
                              : evt.type === 'incident'
                              ? 'bg-rose-500'
                              : evt.type === 'trip'
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                          }`}
                        ></span>
                        <span className="text-slate-700 font-medium">{evt.summary}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 flex-shrink-0 ml-3">{evt.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Incidents */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Actionable Incidents</h3>
              <Link
                to="/admin/incidents"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Queue <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {!data?.recentIncidents || data.recentIncidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No active incidents recorded. Network running smoothly.
                </div>
              ) : (
                data.recentIncidents.slice(0, 5).map((inc) => (
                  <div key={inc.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 capitalize">
                        {inc.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                        {inc.severity || 'ALERT'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{inc.description}</p>
                    <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
                      <span>{inc.vehicleNumber || inc.vehicle_number || 'General Sector'}</span>
                      <span>
                        {inc.createdAt || inc.created_at
                          ? new Date(inc.createdAt || inc.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Recent'}
                      </span>
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
