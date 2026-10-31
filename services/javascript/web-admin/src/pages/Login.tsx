import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Loader2, Shield, User } from 'lucide-react';
import { useAuthStore } from '../state/auth.store';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role?.toUpperCase() === 'STAFF') {
        navigate('/staff/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch {
      // error is stored in useAuthStore
    }
  };

  const handleFillDemo = (role: 'admin' | 'staff') => {
    if (role === 'admin') {
      setEmail('admin@ecotransit.org');
      setPassword('Admin@123');
    } else {
      setEmail('driver1@ecotransit.org');
      setPassword('Staff@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
              <Bus className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">EcoTransit Control</h1>
            <p className="text-slate-400 text-xs mt-1">Unified Admin & Staff Transit Operations Portal</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3.5 mb-6 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Operator / Staff Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@ecotransit.org"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Security Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                'Authenticate & Sign In'
              )}
            </button>
          </form>

          {/* Demo Login Shortcuts */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <p className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider mb-3">
              Quick Autofill Credentials
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleFillDemo('admin')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Admin Operator
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('staff')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Staff / Driver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
