import { useEffect, useState } from 'react';
import {
  Play,
  StopCircle,
  Bus,
  Route as RouteIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useStaffPortalStore } from '../../state/staffPortal.store';
import { fetchRoutes, type Route } from '../../api/routes.api';

export default function StaffShift() {
  const {
    trips,
    activeTrip,
    vehicles,
    loading,
    actionLoading,
    error,
    loadTrips,
    loadVehicles,
    startTrip,
    endTrip,
  } = useStaffPortalStore();

  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [completionNotes, setCompletionNotes] = useState<string>('Shift finished normally. No mechanical issues.');

  useEffect(() => {
    loadTrips();
    loadVehicles();
    fetchRoutes()
      .then((data) => setAvailableRoutes(data))
      .catch(() => setAvailableRoutes([]));
  }, [loadTrips, loadVehicles]);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const vId = parseInt(selectedVehicleId, 10);
    const rId = parseInt(selectedRouteId, 10);

    if (isNaN(vId) || vId <= 0) {
      setFormError('Please select a valid operational vehicle.');
      return;
    }

    if (isNaN(rId) || rId <= 0) {
      setFormError('Please select an assigned transit route.');
      return;
    }

    try {
      await startTrip({
        vehicleId: vId,
        routeId: rId,
        status: 'active',
        startTime: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      setSelectedVehicleId('');
      setSelectedRouteId('');
      setNotes('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to launch shift');
    }
  };

  const handleEndShift = async () => {
    if (!activeTrip) return;
    try {
      await endTrip(activeTrip.id, completionNotes);
      setShowEndModal(false);
      setCompletionNotes('');
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Shift & Trip Operations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Start new scheduled transit duty, track live trip execution, and review your shift history.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Shift Action Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Active Shift Card OR Start Shift Form */}
      {activeTrip ? (
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-emerald-700/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE SHIFT IN PROGRESS
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Operating Vehicle {activeTrip.vehicleNumber || `#${activeTrip.vehicleId}`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-200 pt-2">
                <div>
                  <span className="text-xs text-slate-400 block">Route</span>
                  <span className="font-semibold">{activeTrip.routeName || `Route #${activeTrip.routeId}`}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Shift Commenced</span>
                  <span className="font-semibold">{new Date(activeTrip.startTime).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Registration</span>
                  <span className="font-semibold">{activeTrip.registrationNumber || 'Standard Fleet'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowEndModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-rose-600/30 hover:shadow-rose-600/40"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <StopCircle className="w-5 h-5" />}
                Conclude Shift & Trip
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Play className="w-5 h-5 fill-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Commence New Shift / Trip</h2>
              <p className="text-xs text-slate-500">Assign your operational vehicle and designated transit corridor</p>
            </div>
          </div>

          {formError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
              {formError}
            </div>
          )}

          <form onSubmit={handleStartShift} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Operational Vehicle *
              </label>
              <div className="relative">
                <Bus className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  required
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="">-- Choose vehicle unit --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.registration_number}) — {v.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Only operational vehicles currently in active or standby status may be selected.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Designated Transit Route *
              </label>
              <div className="relative">
                <RouteIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  required
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="">-- Choose route corridor --</option>
                  {availableRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.route_code || 'CODE'})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Selected route determines the telemetry schedule and downstream stop monitoring.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Shift Pre-Departure Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Vehicle inspection completed. Weather clear. Battery 98%."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                Commence Shift Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trip History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Shift & Trip History</h3>
              <p className="text-xs text-slate-500">Record of all transit shifts logged under your account</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {trips.length} Record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-3.5">Trip ID</th>
                <th className="px-6 py-3.5">Vehicle</th>
                <th className="px-6 py-3.5">Route</th>
                <th className="px-6 py-3.5">Started</th>
                <th className="px-6 py-3.5">Concluded</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading shift logbook...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No prior trips found. Start your first shift above.
                  </td>
                </tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">#{t.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {t.vehicleNumber || `Vehicle #${t.vehicleId}`}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {t.routeName || `Route #${t.routeId}`}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(t.startTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {t.endTime ? new Date(t.endTime).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          t.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                        {t.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate">
                      {t.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* End Shift Confirmation Modal */}
      {showEndModal && activeTrip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <StopCircle className="w-8 h-8" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Shift Conclusion</h3>
                <p className="text-xs text-slate-500">Trip #{activeTrip.id} • {activeTrip.vehicleNumber}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Completing this shift will finalize telemetry logging for this journey and return vehicle unit to the available depot pool.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Debrief / Shift Completion Notes
              </label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Provide notes on bus condition, mileage, or operational delays..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndShift}
                disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold shadow-md shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm & Complete Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
