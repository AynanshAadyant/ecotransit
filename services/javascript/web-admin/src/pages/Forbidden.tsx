import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuthStore } from '../state/auth.store';

export default function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const targetDashboard =
    user?.role?.toUpperCase() === 'STAFF' ? '/staff/dashboard' : '/admin/dashboard';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight">403 — Access Forbidden</h1>
        <p className="text-sm text-slate-400 mt-2">
          Your account role (<span className="font-semibold text-rose-300">{user?.role || 'Guest'}</span>) does not have authorization to view this resource.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Role Boundary Rules:</p>
          <p>• Administrator accounts access <code className="text-indigo-300">/admin/*</code></p>
          <p>• Staff / Driver accounts access <code className="text-emerald-300">/staff/*</code></p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-700/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link
            to={targetDashboard}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
