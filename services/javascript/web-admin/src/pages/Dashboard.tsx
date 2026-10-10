import { Users, Bus, Map, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Vehicles', value: '24', icon: Bus, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active Routes', value: '12', icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Active Staff', value: '45', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Open Incidents', value: '3', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
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
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Recent Incidents</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-start p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="w-2 h-2 mt-2 rounded-full bg-rose-500 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Vehicle Breakdown reported on Route 419</p>
                  <p className="text-sm text-gray-500 mt-1">10 minutes ago ??? DL1PC8888</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Fleet Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-gray-600">On Route (Active)</span>
              <span className="text-emerald-600">18 Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '75%' }}></div>
            </div>

            <div className="flex justify-between items-center text-sm font-medium mt-4">
              <span className="text-gray-600">In Maintenance</span>
              <span className="text-amber-500">4 Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-amber-400 h-2 rounded-full" style={{ width: '15%' }}></div>
            </div>

            <div className="flex justify-between items-center text-sm font-medium mt-4">
              <span className="text-gray-600">Offline / Depot</span>
              <span className="text-gray-500">2 Vehicles</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-gray-400 h-2 rounded-full" style={{ width: '10%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
