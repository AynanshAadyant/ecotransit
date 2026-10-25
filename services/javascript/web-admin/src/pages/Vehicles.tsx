import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Edit2, Bus, Filter, X , Loader2 } from 'lucide-react';
import { useVehiclesStore } from '../state/vehicles.store';
import { useToastStore } from '../state/toast.store';
import { fetchRoutes, type Route } from '../api/routes.api';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { TableRowSkeleton } from '../components/Skeleton';
import type { Vehicle, CreateVehiclePayload } from '../api/vehicles.api';

export default function Vehicles() {
  const { vehicles, loading, actionLoading, error, fetch, add, edit, remove } = useVehiclesStore();
  const { showToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [routes, setRoutes] = useState<Route[]>([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form State
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Electric Bus');
  const [capacity, setCapacity] = useState('40');
  const [routeId, setRouteId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState('active');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Delete Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  useEffect(() => {
    fetch();
    fetchRoutes()
      .then((data) => setRoutes(data))
      .catch(() => setRoutes([]));
  }, [fetch]);

  const openCreateModal = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setRegistrationNumber('');
    setVehicleType('Electric Bus');
    setCapacity('40');
    setRouteId('');
    setDeviceId('');
    setStatus('active');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setVehicleNumber(v.vehicleNumber || v.vehicle_number || '');
    setRegistrationNumber(v.registrationNumber || v.registration_number || '');
    setVehicleType(v.vehicleType || v.type || 'Electric Bus');
    setCapacity(String(v.capacity ?? 40));
    setRouteId(v.routeId ? String(v.routeId) : v.route_id ? String(v.route_id) : '');
    setDeviceId(v.deviceId || v.gps_device_id || '');
    setStatus(v.status || 'active');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const vNum = vehicleNumber.trim().toUpperCase();
    const regNum = registrationNumber.trim().toUpperCase();

    if (!vNum) {
      setValidationError('Vehicle number is required (e.g. DL1PC8888).');
      return;
    }

    if (!regNum) {
      setValidationError('Registration plate number is required.');
      return;
    }

    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setValidationError('Capacity must be a positive integer.');
      return;
    }

    const payload: CreateVehiclePayload = {
      vehicleNumber: vNum,
      registrationNumber: regNum,
      vehicleType: vehicleType.trim(),
      capacity: cap,
      routeId: routeId ? parseInt(routeId, 10) : null,
      deviceId: deviceId.trim() || null,
      status,
    };

    try {
      if (editingVehicle) {
        await edit(editingVehicle.id, payload);
        showToast(`Vehicle ${vNum} updated successfully!`, 'success');
      } else {
        await add(payload);
        showToast(`Vehicle ${vNum} registered to fleet!`, 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const promptDelete = (v: Vehicle) => {
    setVehicleToDelete(v);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await remove(vehicleToDelete.id);
      showToast(`Vehicle ${vehicleToDelete.vehicleNumber || vehicleToDelete.vehicle_number || `#${vehicleToDelete.id}`} removed from fleet.`, 'info');
      setDeleteConfirmOpen(false);
      setVehicleToDelete(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete vehicle', 'error');
    }
  };

  const filtered = vehicles.filter((v) => {
    const num = (v.vehicleNumber || v.vehicle_number || '').toLowerCase();
    const reg = (v.registrationNumber || v.registration_number || '').toLowerCase();
    const type = (v.vehicleType || v.type || '').toLowerCase();
    const matchesSearch =
      num.includes(search.toLowerCase()) ||
      reg.includes(search.toLowerCase()) ||
      type.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;



  const paginatedVehicles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Fleet Vehicle Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain active vehicle assets, onboard hardware telemetry devices, and route assignments.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle Unit
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Control Bar: Search and Status Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle number, plate, type..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
            {filtered.length} of {vehicles.length} Units
          </span>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Vehicle Identifier</th>
                <th className="px-6 py-4">Plate / Registration</th>
                <th className="px-6 py-4">Type & Capacity</th>
                <th className="px-6 py-4">Assigned Corridor</th>
                <th className="px-6 py-4">Telemetry Device</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && vehicles.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={8} />
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    <EmptyState
                      icon={Bus}
                      title="No vehicles found"
                      description={
                        search || statusFilter !== 'all'
                          ? 'No vehicles match your search or filter criteria. Try adjusting your parameters.'
                          : 'No fleet vehicles are registered in the system yet.'
                      }
                      action={
                        search || statusFilter !== 'all'
                          ? undefined
                          : {
                              label: 'Register First Vehicle',
                              onClick: openCreateModal,
                              icon: Plus,
                            }
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((v) => {
                  const num = v.vehicleNumber || v.vehicle_number || `Unit #${v.id}`;
                  const reg = v.registrationNumber || v.registration_number || '—';
                  const type = v.vehicleType || v.type || 'Electric Bus';
                  const dev = v.deviceId || v.gps_device_id || null;
                  const rName = v.routeName || (v.routeId ? `Route #${v.routeId}` : v.route_id ? `Route #${v.route_id}` : 'Unassigned');

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">#{v.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{num}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{reg}</td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {type} • {v.capacity ?? 40} seats
                      </td>
                      <td className="px-6 py-4 text-slate-700 text-xs font-medium">
                        {rName}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {dev ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {dev}
                          </span>
                        ) : (
                          <span className="text-slate-400">No device linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                            v.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.status === 'maintenance'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              v.status === 'active'
                                ? 'bg-emerald-500'
                                : v.status === 'maintenance'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          ></span>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(v)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Vehicle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptDelete(v)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Vehicle"
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
        <Pagination
          currentPage={page}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Create / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingVehicle ? `Edit Vehicle #${editingVehicle.id}` : 'Register New Fleet Vehicle'}
                  </h3>
                  <p className="text-xs text-slate-500">Provide verified transit vehicle attributes</p>
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
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL1PC8888"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Registration Plate *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL-01-A-1234"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Electric Bus">Electric Bus</option>
                    <option value="CNG Low Floor">CNG Low Floor</option>
                    <option value="Standard Diesel">Standard Diesel</option>
                    <option value="Feeder Minibus">Feeder Minibus</option>
                    <option value="BRT Articulated">BRT Articulated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Assigned Corridor / Route
                  </label>
                  <select
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- No Route Assigned --</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.routeCode || r.route_code || 'CODE'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Operational Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="active">Active (In Service)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive / Depot</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  GPS Telemetry Device Hardware ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GPS-TC-9801"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                  {editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Remove Vehicle from Registry"
        message={`Are you sure you want to permanently delete vehicle ${
          vehicleToDelete?.vehicleNumber || vehicleToDelete?.vehicle_number || `#${vehicleToDelete?.id}`
        }? This operation removes active telemetry tracking linkages.`}
        confirmText="Delete Vehicle"
        cancelText="Keep Vehicle"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setVehicleToDelete(null);
        }}
      />
    </div>
  );
}
