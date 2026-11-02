import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Edit2, Users, Shield, Phone, Mail, X , Loader2 } from 'lucide-react';
import { useStaffStore } from '../state/staff.store';
import { useToastStore } from '../state/toast.store';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { TableRowSkeleton } from '../components/Skeleton';
import type { Staff, CreateStaffPayload } from '../api/staff.api';

export default function StaffPage() {
  const { staff, loading, actionLoading, error, fetch, add, edit, remove } = useStaffStore();
  const { showToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [status, setStatus] = useState('active');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreateModal = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('STAFF');
    setStatus('active');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Staff) => {
    setEditingStaff(s);
    setName(s.name);
    setEmail(s.email);
    setPassword('');
    setPhone(s.phone || '');
    setRole((s.role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF'));
    setStatus(s.status || 'active');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setValidationError('Name must be at least 2 characters long.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setValidationError('A valid email address is required.');
      return;
    }

    if (!editingStaff && (!password || password.length < 6)) {
      setValidationError('Password is required (minimum 6 characters).');
      return;
    }

    if (editingStaff && password && password.length < 6) {
      setValidationError('New password must be at least 6 characters long.');
      return;
    }

    const payload: CreateStaffPayload = {
      name: trimmedName,
      email: trimmedEmail,
      password: password || 'Default@123',
      phone: phone.trim() || undefined,
      role,
    };

    try {
      if (editingStaff) {
        const updatePayload: Partial<CreateStaffPayload> = {
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          role,
        };
        if (password) updatePayload.password = password;
        await edit(editingStaff.id, updatePayload);
        showToast(`Staff member "${trimmedName}" updated successfully!`, 'success');
      } else {
        await add(payload);
        showToast(`New staff member "${trimmedName}" registered!`, 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Staff operation failed');
    }
  };

  const promptDelete = (s: Staff) => {
    setStaffToDelete(s);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!staffToDelete) return;
    try {
      await remove(staffToDelete.id);
      showToast(`Account for ${staffToDelete.name} was deleted.`, 'info');
      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete staff account', 'error');
    }
  };

  const filtered = staff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search));
    const matchesRole = roleFilter === 'all' || s.role.toUpperCase() === roleFilter.toUpperCase();
    return matchesSearch && matchesRole;
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;



  const paginatedStaff = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Staff & Driver Personnel</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage dispatchers, bus operators, and system administration accounts.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
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
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Roles</option>
            <option value="STAFF">Staff / Drivers</option>
            <option value="ADMIN">Administrators</option>
          </select>
          <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
            {filtered.length} of {staff.length} Personnel
          </span>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && staff.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={7} />
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <EmptyState
                      icon={Users}
                      title="No staff personnel found"
                      description={
                        search || roleFilter !== 'all'
                          ? 'No staff members match the selected filter or search keyword.'
                          : 'No staff personnel registered yet.'
                      }
                      action={
                        search || roleFilter !== 'all'
                          ? undefined
                          : {
                              label: 'Add First Staff Member',
                              onClick: openCreateModal,
                              icon: Plus,
                            }
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">#{s.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {s.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {s.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {s.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.role?.toUpperCase() === 'ADMIN'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {s.role}
                      </span>
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
                          title="Edit Staff Member"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => promptDelete(s)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Staff Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Create / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingStaff ? `Edit Personnel #${editingStaff.id}` : 'Create Staff Account'}
                  </h3>
                  <p className="text-xs text-slate-500">Provide staff profile credentials</p>
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
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. operator@ecotransit.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {editingStaff ? 'Reset Security Password (Leave blank to keep current)' : 'Security Password *'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {!editingStaff && (
                  <p className="text-[11px] text-slate-400 mt-1">Minimum 6 characters required.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Authorization Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'STAFF' | 'ADMIN')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="STAFF">Staff / Driver Operator</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="active">Active (Permitted login)</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
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
                  {editingStaff ? 'Update Staff Member' : 'Register Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Revoke Staff Account"
        message={`Are you sure you want to permanently delete account for ${staffToDelete?.name} (${staffToDelete?.email})? This will revoke mobile portal access.`}
        confirmText="Revoke & Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setStaffToDelete(null);
        }}
      />
    </div>
  );
}
