import { Search, Plus, MoreVertical } from 'lucide-react';

export default function Vehicles() {
  const vehicles = [
    { id: '1', number: 'DL1PC8888', route: 'Route 419', status: 'active', lastSeen: '2 mins ago' },
    { id: '2', number: 'DL1PC9999', route: 'Route 420', status: 'active', lastSeen: '1 min ago' },
    { id: '3', number: 'DL1PC7777', route: 'Route 101', status: 'maintenance', lastSeen: '2 hrs ago' },
    { id: '4', number: 'DL1PC6666', route: 'Unassigned', status: 'offline', lastSeen: '1 day ago' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search vehicles..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-6 py-4">Vehicle Number</th>
              <th className="px-6 py-4">Assigned Route</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Seen</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{v.number}</td>
                <td className="px-6 py-4 text-gray-600">{v.route}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    v.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    v.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">{v.lastSeen}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
