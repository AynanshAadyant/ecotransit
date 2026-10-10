export default function Incidents() {
  const incidents = [
    { id: '1', type: 'Breakdown', vehicle: 'DL1PC8888', route: 'Route 419', status: 'open', reportedAt: '10 mins ago' },
    { id: '2', type: 'Traffic', vehicle: 'DL1PC9999', route: 'Route 420', status: 'acknowledged', reportedAt: '1 hour ago' },
    { id: '3', type: 'Accident', vehicle: 'DL1PC7777', route: 'Route 101', status: 'resolved', reportedAt: '1 day ago' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-lg font-bold text-gray-800">Incident Management</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Vehicle</th>
              <th className="px-6 py-4">Route</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {incidents.map((inc) => (
              <tr key={inc.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{inc.type}</td>
                <td className="px-6 py-4 text-gray-600">{inc.vehicle}</td>
                <td className="px-6 py-4 text-gray-600">{inc.route}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    inc.status === 'open' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    inc.status === 'acknowledged' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {inc.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">{inc.reportedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
