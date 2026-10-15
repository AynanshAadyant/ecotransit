import { useEffect } from 'react';
import { Users, Bus, Map, AlertTriangle, Loader2 } from 'lucide-react';
import { useDashboardStore } from '../state/dashboard.store';

export default function Dashboard() {
  const { data, loading, error, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700">
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchDashboard} className="mt-3 text-sm font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  const stats = [
    { label: 'Total Vehicles', value: data?.totalVehicles ?? 0, icon: Bus, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active Routes', value: data?.activeRoutes ?? 0, icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Total Staff', value: data?.totalStaff ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Open Incidents', value: data?.openIncidents ?? 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-200">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent Incidents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Recent Incidents</h3>
          <div className="space-y-4">
            {data?.recentIncidents && data.recentIncidents.length > 0 ? (
              data.recentIncidents.map((inc) => (
                <div key={inc.id} className="flex gap-4 items-start p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-2 h-2 mt-2 rounded-full bg-rose-500 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-gray-800">{inc.type} — {inc.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(inc.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No recent incidents</p>
            )}
          </div>
        </div>

        {/* Fleet Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Fleet Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-gray-600">On Route (Active)</span>
              <span className="text-emerald-600">{data?.fleetStatus?.active ?? 0} Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${data?.totalVehicles ? ((data.fleetStatus?.active ?? 0) / data.totalVehicles) * 100 : 0}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-sm font-medium mt-4">
              <span className="text-gray-600">In Maintenance</span>
              <span className="text-amber-500">{data?.fleetStatus?.maintenance ?? 0} Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${data?.totalVehicles ? ((data.fleetStatus?.maintenance ?? 0) / data.totalVehicles) * 100 : 0}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-sm font-medium mt-4">
              <span className="text-gray-600">Offline / Depot</span>
              <span className="text-gray-500">{data?.fleetStatus?.offline ?? 0} Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-gray-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${data?.totalVehicles ? ((data.fleetStatus?.offline ?? 0) / data.totalVehicles) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
