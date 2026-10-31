import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Bus,
} from 'lucide-react';
import { useStaffPortalStore } from '../../state/staffPortal.store';

export default function StaffIncidents() {
  const { incidents, loading, error, loadIncidents } = useStaffPortalStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const filtered = incidents.filter((inc) => {
    const matchesStatus =
      statusFilter === 'all' || inc.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.vehicleNumber && inc.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reported Incidents Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track operational disruptions, mechanical fault investigations, and clearance status.
          </p>
        </div>

        <Link
          to="/staff/incidents/report"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Report Disruption
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {[
            { id: 'all', label: 'All Incidents' },
            { id: 'reported', label: 'Reported' },
            { id: 'under_investigation', label: 'Investigating' },
            { id: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search description, vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/20"
          />
        </div>
      </div>

      {/* Incidents List */}
      {loading && incidents.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto mb-2" />
          Loading reported disruptions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Incidents Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm || statusFilter !== 'all'
              ? 'No records match your selected filter criteria.'
              : 'All corridors operate with zero logged disruptions.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block">
                      INCIDENT #{inc.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 capitalize">
                      {inc.type.replace(/_/g, ' ')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        inc.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : inc.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : inc.severity === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        inc.status === 'resolved'
                          ? 'bg-blue-100 text-blue-800'
                          : inc.status === 'under_investigation'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {inc.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 mb-4">{inc.description}</p>

                {inc.adminNotes && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-3">
                    <span className="font-semibold text-slate-700 block mb-0.5">Control Center Notes:</span>
                    <span className="text-slate-600">{inc.adminNotes}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                <div className="flex items-center gap-3">
                  {inc.vehicleNumber && (
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Bus className="w-3.5 h-3.5 text-slate-400" />
                      {inc.vehicleNumber}
                    </span>
                  )}
                  {inc.latitude && inc.longitude && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(inc.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
