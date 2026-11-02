import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Edit2, Loader2, Route as RouteIcon, MapPin, X } from 'lucide-react';
import { useRoutesStore } from '../state/routes.store';
import { useToastStore } from '../state/toast.store';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Route, CreateRoutePayload } from '../api/routes.api';

export default function RoutesPage() {
  const { routes, loading, actionLoading, error, fetch, add, edit, remove } = useRoutesStore();
  const { showToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [distanceKm, setDistanceKm] = useState('0');
  const [status, setStatus] = useState('active');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreateModal = () => {
    setEditingRoute(null);
    setName('');
    setRouteCode('');
    setDescription('');
    setOrigin('');
    setDestination('');
    setDistanceKm('12.5');
    setStatus('active');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (r: Route) => {
    setEditingRoute(r);
    setName(r.name);
    setRouteCode(r.routeCode || r.route_code || '');
    setDescription(r.description || '');
    setOrigin(r.origin || '');
    setDestination(r.destination || '');
    setDistanceKm(String(r.distanceKm || r.distance_km || 0));
    setStatus(r.status || 'active');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const code = routeCode.trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Route corridor name is required.');
      return;
    }

    if (!code) {
      setValidationError('Route code is required (e.g. RTE-101).');
      return;
    }

    const dist = parseFloat(distanceKm);
    if (isNaN(dist) || dist < 0) {
      setValidationError('Distance must be a valid positive number in kilometers.');
      return;
    }

    const payload: CreateRoutePayload = {
      name: trimmedName,
      routeCode: code,
      description: description.trim() || undefined,
      origin: origin.trim() || undefined,
      destination: destination.trim() || undefined,
      distanceKm: dist,
      status,
    };

    try {
      if (editingRoute) {
        await edit(editingRoute.id, payload);
        showToast(`Route ${code} updated successfully!`, 'success');
      } else {
        await add(payload);
        showToast(`Route ${code} — "${trimmedName}" created!`, 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Route operation failed');
    }
  };

  const promptDelete = (r: Route) => {
    setRouteToDelete(r);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!routeToDelete) return;
    try {
      await remove(routeToDelete.id);
      showToast(`Route ${routeToDelete.routeCode || routeToDelete.route_code || routeToDelete.name} deleted.`, 'info');
      setDeleteConfirmOpen(false);
      setRouteToDelete(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete route', 'error');
    }
  };

  const filtered = routes.filter((r) => {
    const code = (r.routeCode || r.route_code || '').toLowerCase();
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      code.includes(search.toLowerCase()) ||
      (r.origin && r.origin.toLowerCase().includes(search.toLowerCase())) ||
      (r.destination && r.destination.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transit Route Corridors</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure line topologies, route codes, origins, destinations, and stop associations.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Route
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
            placeholder="Search route name, code, origin, destination..."
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
            <option value="all">All Corridors</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
            {filtered.length} of {routes.length} Corridors
          </span>
        </div>
      </div>

      {/* Routes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Route Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Terminals (Origin → Destination)</th>
                <th className="px-6 py-4">Distance</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && routes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Querying route schedules...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No routes found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const code = r.routeCode || r.route_code || '—';
                  const originText = r.origin || 'Depot Terminal';
                  const destText = r.destination || 'Downtown Terminal';
                  const dist = r.distanceKm || r.distance_km || 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">#{r.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{r.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg font-bold">
                          {code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{originText}</span>
                          <span className="text-slate-400 font-bold">→</span>
                          <span>{destText}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs font-mono">
                        {dist > 0 ? `${dist} km` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                            r.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              r.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Route"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptDelete(r)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Route"
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

      {/* Create / Edit Route Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RouteIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingRoute ? `Edit Route #${editingRoute.id}` : 'Create New Route Corridor'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure transit line parameters</p>
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
                    Route Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ring Road Express"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Route Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RTE-419"
                    value={routeCode}
                    onChange={(e) => setRouteCode(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Origin Terminal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anand Vihar ISBT"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Destination Terminal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kashmere Gate ISBT"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Corridor Distance (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Route Description & Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key waypoints, high-density hubs, or peak hour frequencies..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
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
                  {editingRoute ? 'Update Corridor' : 'Save New Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Remove Transit Route"
        message={`Are you sure you want to permanently delete route ${routeToDelete?.name} (${routeToDelete?.routeCode || routeToDelete?.route_code})? Active trips linked to this route will require reassignment.`}
        confirmText="Delete Route"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setRouteToDelete(null);
        }}
      />
    </div>
  );
}
