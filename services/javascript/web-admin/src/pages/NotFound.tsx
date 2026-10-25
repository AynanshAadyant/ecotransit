import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, Home } from 'lucide-react';
import { useAuthStore } from '../state/auth.store';

export default function NotFound() {
  const { isAuthenticated, user } = useAuthStore();

  const homePath = isAuthenticated
    ? user?.role?.toUpperCase() === 'STAFF'
      ? '/staff/dashboard'
      : '/admin/dashboard'
    : '/login';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
          Error 404
        </span>

        <h1 className="text-2xl font-bold text-white tracking-tight mt-3">Route Not Found</h1>
        <p className="text-sm text-slate-400 mt-2">
          The transit terminal, station, or resource you are looking for does not exist or has been relocated.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={homePath}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Safe Terminal
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous Page
          </button>
        </div>
      </div>
    </div>
  );
}
