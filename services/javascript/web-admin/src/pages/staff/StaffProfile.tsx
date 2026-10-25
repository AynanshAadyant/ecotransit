import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Shield,
  Clock,
  LogOut,
  Bus,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../state/auth.store';
import { useStaffPortalStore } from '../../state/staffPortal.store';

export default function StaffProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { trips, incidents, activeTrip, loadTrips, loadIncidents } = useStaffPortalStore();

  useEffect(() => {
    loadTrips();
    loadIncidents();
  }, [loadTrips, loadIncidents]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Profile & Credentials</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your operational assignment identity, duty statistics, and account security.
        </p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-emerald-600/20">
            {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{user?.name || 'Staff Operator'}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {user?.status ? user.status.toUpperCase() : 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Staff ID #{user?.id || '---'}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Role: {user?.role || 'STAFF'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
        >
          <LogOut className="w-4 h-4" />
          End Session & Sign Out
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Shifts Logged</p>
            <p className="text-xl font-bold text-slate-800">{trips.length} Trips</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Incidents Filed</p>
            <p className="text-xl font-bold text-slate-800">{incidents.length} Reported</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Current Assignment</p>
            <p className="text-xl font-bold text-slate-800">
              {activeTrip ? activeTrip.vehicleNumber || `Unit #${activeTrip.vehicleId}` : 'Off Duty'}
            </p>
          </div>
        </div>
      </div>

      {/* Contact & Security Details */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">
          Account & Communication Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" />
              Registered Email Address
            </span>
            <p className="font-semibold text-slate-800 pl-5">{user?.email || 'Not specified'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-slate-400" />
              Dispatch Mobile Number
            </span>
            <p className="font-semibold text-slate-800 pl-5">{user?.phone || '+91 (Field Phone Configured)'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Registered Timestamp
            </span>
            <p className="font-semibold text-slate-800 pl-5">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Operator'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-400" />
              Access Level
            </span>
            <p className="font-semibold text-slate-800 pl-5">
              Authorized for Mobile Telemetry & Incident Dispatch
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
