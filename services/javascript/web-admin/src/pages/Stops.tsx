import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Edit2, Loader2, MapPin, LocateFixed, X } from 'lucide-react';
import { useStopsStore } from '../state/stops.store';
import { useToastStore } from '../state/toast.store';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Stop, CreateStopPayload } from '../api/stops.api';

export default function StopsPage() {
  const { stops, loading, actionLoading, error, fetch, add, edit, remove } = useStopsStore();
  const { showToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [stopCode, setStopCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('active');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [stopToDelete, setStopToDelete] = useState<Stop | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreateModal = () => {
    setEditingStop(null);
    setName('');
    setStopCode('');
    setLatitude('28.6139');
    setLongitude('77.2090');
    setAddress('');
    setStatus('active');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Stop) => {
    setEditingStop(s);
    setName(s.name);
    setStopCode(s.stopCode || s.stop_code || '');
    setLatitude(String(s.latitude));
    setLongitude(String(s.longitude));
    setAddress(s.address || '');
    setStatus(s.status || 'active');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const code = stopCode.trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Stop terminal name is required.');
      return;
    }

    if (!code) {
      setValidationError('Stop code is required (e.g. STP-101).');
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setValidationError('Latitude must be a valid coordinate between -90 and 90.');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      setValidationError('Longitude must be a valid coordinate between -180 and 180.');
      return;
    }

    const payload: CreateStopPayload = {
      name: trimmedName,
      stopCode: code,
      latitude: lat,
      longitude: lon,
      address: address.trim() || undefined,
      status,
    };

    try {
      if (editingStop) {
        await edit(editingStop.id, payload);
        showToast(`Stop ${code} updated successfully!`, 'success');
      } else {
        await add(payload);
        showToast(`Stop ${code} — "${trimmedName}" registered!`, 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Stop operation failed');
    }
  };

  const promptDelete = (s: Stop) => {
    setStopToDelete(s);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!stopToDelete) return;
    try {
      await remove(stopToDelete.id);
      showToast(`Stop ${stopToDelete.stopCode || stopToDelete.stop_code || stopToDelete.name} deleted.`, 'info');
      setDeleteConfirmOpen(false);
      setStopToDelete(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete stop', 'error');
    }
  };

  const filtered = stops.filter((s) => {
    const code = (s.stopCode || s.stop_code || '').toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      code.includes(search.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transit Stop Terminals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain geospatial stop locations, codes, cluster associations, and street addresses.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Stop Terminal
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stop name, code, landmark..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Terminals</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
            {filtered.length} of {stops.length} Stops
          </span>
        </div>
      </div>

      {/* Stops Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Stop Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Coordinates (Lat, Lon)</th>
                <th className="px-6 py-4">Street / Landmark</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && stops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Querying stop coordinates...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No stops found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const code = s.stopCode || s.stop_code || '—';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">#{s.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{s.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg font-bold">
                          {code}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs max-w-xs truncate">
                        {s.address || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Stop"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptDelete(s)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Stop"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Stop Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingStop ? `Edit Stop Terminal #${editingStop.id}` : 'Register New Stop Terminal'}
                  </h3>
                  <p className="text-xs text-slate-500">Provide geographic location attributes</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs mb-4">
                {validationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Terminal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Connaught Place"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Stop Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CP-01"
                    value={stopCode}
                    onChange={(e) => setStopCode(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Geographic Coordinates (WGS-84) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
                    Detect Location
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Latitude (-90 to 90)"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Longitude (-180 to 180)"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Street Address / Landmark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Radial Road 2, Block B"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Terminal Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="active">Active (Operational)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingStop ? 'Update Terminal' : 'Register Stop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Remove Transit Stop"
        message={`Are you sure you want to permanently delete stop ${stopToDelete?.name} (${stopToDelete?.stopCode || stopToDelete?.stop_code})? Any routes utilizing this terminal will have their waypoint sequences updated.`}
        confirmText="Delete Stop"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setStopToDelete(null);
        }}
      />
    </div>
  );
}
