import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bus,
  LayoutDashboard,
  Clock,
  AlertTriangle,
  PlusCircle,
  User as UserIcon,
  LogOut,
  Bell,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../state/auth.store';
import { useStaffPortalStore } from '../state/staffPortal.store';

export default function StaffLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { activeTrip } = useStaffPortalStore();

  const navItems = [
    { name: 'Dashboard', path: '/staff/dashboard', icon: LayoutDashboard },
    { name: 'Shift & Trips', path: '/staff/shift', icon: Clock },
    { name: 'Report Incident', path: '/staff/incidents/report', icon: PlusCircle },
    { name: 'My Incidents', path: '/staff/incidents', icon: AlertTriangle },
    { name: 'Profile', path: '/staff/profile', icon: UserIcon },
  ];

  const currentTitle =
    navItems.find((i) => location.pathname === i.path || (i.path !== '/staff/dashboard' && location.pathname.startsWith(i.path)))?.name ||
    'Staff Operations';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Staff Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">EcoTransit</h1>
            <p className="text-xs text-emerald-400 font-medium">Staff Portal</p>
          </div>
        </div>

        {/* Shift status pill */}
        <div className="px-4 pt-4">
          <div
            className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
              activeTrip
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
            }`}
          >
            {activeTrip ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold truncate">Active Shift: {activeTrip.vehicleNumber || `Trip #${activeTrip.id}`}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Off Shift / Idle</span>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/staff/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center justify-center font-bold text-xs">
              {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Staff Member'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'staff@ecotransit.org'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:px-8 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">{currentTitle}</h2>
            {activeTrip ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                On Duty ({activeTrip.routeName || 'Active Route'})
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <AlertCircle className="w-3 h-3 text-slate-400" />
                Available for Shift
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-800">{user?.name || 'Staff User'}</p>
                <p className="text-xs text-gray-500 font-medium">Transit Operator</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50/70 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
