import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  Bus,
  Route as RouteIcon,
  UserCheck,
  Check,
  X,
  Loader2,
  Eye,
  Filter,
} from 'lucide-react';
import { useIncidentsStore } from '../state/incidents.store';
import { useToastStore } from '../state/toast.store';
import { fetchStaff, type Staff } from '../api/staff.api';
import type { Incident } from '../api/incidents.api';

export default function Incidents() {
  const {
    incidents,
    loading,
    actionLoading,
    error,
    fetch,
    updateStatus,
    assignToStaff,
    resolveIncident,
  } = useIncidentsStore();

  const { showToast } = useToastStore();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Active Staff List for assignment
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);

  // Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');

  // Resolve Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState<string>('Disruption addressed and cleared from corridor.');

  useEffect(() => {
    fetch();
    fetchStaff()
      .then((data) => setStaffList(data.filter((s) => s.status === 'active')))
      .catch(() => setStaffList([]));
  }, [fetch]);

  const openDetail = (inc: Incident) => {
    setActiveIncident(inc);
    setDetailModalOpen(true);
  };

  const openAssign = (inc: Incident) => {
    setActiveIncident(inc);
    setSelectedStaffId(staffList[0] ? String(staffList[0].id) : '');
    setAssignNotes('Dispatching staff to coordinate with vehicle operator.');
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!activeIncident || !selectedStaffId) return;
    const staffMember = staffList.find((s) => s.id === parseInt(selectedStaffId, 10));
    const staffName = staffMember?.name || `Staff #${selectedStaffId}`;

    try {
      const updated = await assignToStaff(
        activeIncident.id,
        staffName,
        parseInt(selectedStaffId, 10),
        assignNotes
      );
      setActiveIncident(updated);
      showToast(`Incident #${activeIncident.id} assigned to ${staffName}.`, 'success');
      setAssignModalOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Assignment failed', 'error');
    }
  };

  const openResolve = (inc: Incident) => {
    setActiveIncident(inc);
    setResolutionNotes('Transit operations restored to normal schedule.');
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async () => {
    if (!activeIncident) return;
    try {
      const updated = await resolveIncident(activeIncident.id, resolutionNotes);
      setActiveIncident(updated);
      showToast(`Incident #${activeIncident.id} marked as RESOLVED.`, 'success');
      setResolveModalOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Resolution failed', 'error');
    }
  };

  const handleQuickStatusChange = async (incId: number, newStatus: string) => {
    try {
      const updated = await updateStatus(incId, { status: newStatus });
      if (activeIncident?.id === incId) {
        setActiveIncident(updated);
      }
      showToast(`Incident #${incId} status changed to ${newStatus}.`, 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  };

  const filtered = incidents.filter((inc) => {
    const matchesStatus =
      statusFilter === 'all' || inc.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSeverity =
      severityFilter === 'all' || inc.severity.toLowerCase() === severityFilter.toLowerCase();
    const matchesSearch =
      inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.vehicleNumber && inc.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inc.reportedByName && inc.reportedByName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Incident & Hazard Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review reported route disruptions, assign field staff, and execute incident lifecycle closures.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, vehicle, reporter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 ml-1 whitespace-nowrap">
            {filtered.length} of {incidents.length} Incidents
          </span>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Type & Details</th>
                <th className="px-6 py-4">Vehicle / Route</th>
                <th className="px-6 py-4">Reported By</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Lifecycle Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Querying incident logbook...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No incident records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">#{inc.id}</td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-bold text-slate-900 capitalize block">
                          {inc.type.replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{inc.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="space-y-0.5">
                        {inc.vehicleNumber && (
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <Bus className="w-3.5 h-3.5 text-slate-400" />
                            {inc.vehicleNumber}
                          </div>
                        )}
                        {inc.routeName && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <RouteIcon className="w-3.5 h-3.5 text-slate-400" />
                            {inc.routeName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">{inc.reportedByName || `User #${inc.reportedBy || inc.reported_by || '?'}`}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(inc.createdAt || inc.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
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
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={inc.status}
                        onChange={(e) => handleQuickStatusChange(inc.id, e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none ${
                          inc.status === 'resolved'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : inc.status === 'under_investigation'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : inc.status === 'dismissed'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <option value="reported">Reported</option>
                        <option value="under_investigation">Under Investigation</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetail(inc)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Incident Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {inc.status !== 'resolved' && (
                          <>
                            <button
                              onClick={() => openAssign(inc)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Assign Staff Dispatcher"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openResolve(inc)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Mark as Resolved"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Detail Modal */}
      {detailModalOpen && activeIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Incident #{activeIncident.id} — {activeIncident.type.replace(/_/g, ' ').toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Logged: {new Date(activeIncident.createdAt || activeIncident.created_at || '').toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Severity</span>
                  <span className="font-bold text-slate-800 uppercase text-xs">{activeIncident.severity}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className="font-bold text-slate-800 uppercase text-xs">{activeIncident.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Description of Disruption
                </span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700 text-xs leading-relaxed">
                  {activeIncident.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Vehicle Asset:</span>
                  <span className="font-semibold text-slate-800">
                    {activeIncident.vehicleNumber || 'No vehicle linked'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Corridor Route:</span>
                  <span className="font-semibold text-slate-800">
                    {activeIncident.routeName || 'General network location'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reported By:</span>
                  <span className="font-semibold text-slate-800">
                    {activeIncident.reportedByName || `User #${activeIncident.reportedBy || activeIncident.reported_by}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Coordinates:</span>
                  <span className="font-semibold text-slate-800">
                    {activeIncident.latitude && activeIncident.longitude
                      ? `${activeIncident.latitude.toFixed(4)}, ${activeIncident.longitude.toFixed(4)}`
                      : 'None provided'}
                  </span>
                </div>
              </div>

              {/* Admin / Resolution Notes */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Dispatch & Resolution Notes
                </span>
                <p className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-slate-700 text-xs">
                  {activeIncident.adminNotes || activeIncident.admin_notes || 'No dispatch notes recorded yet.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                {activeIncident.status !== 'resolved' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        openAssign(activeIncident);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Assign Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        openResolve(activeIncident);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Staff Modal */}
      {assignModalOpen && activeIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-purple-600 mb-4">
              <UserCheck className="w-8 h-8" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Incident to Staff</h3>
                <p className="text-xs text-slate-500">Incident #{activeIncident.id} • {activeIncident.type}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Field Operator / Technician *
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) — {s.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Directive / Investigation Order
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Instructions for the assigned staff member..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !selectedStaffId}
                  onClick={handleConfirmAssign}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 transition-all disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {resolveModalOpen && activeIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Resolve Route Incident</h3>
                <p className="text-xs text-slate-500">Incident #{activeIncident.id} • {activeIncident.type}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resolution Notes *
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Document resolution action taken, mechanical clearance, or road re-opening..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmResolve}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
