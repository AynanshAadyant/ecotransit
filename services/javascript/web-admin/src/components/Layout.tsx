import { Outlet, Link, useLocation } from 'react-router-dom';
import { Bus, LayoutDashboard, AlertTriangle, Settings, Bell } from 'lucide-react';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Vehicles', path: '/vehicles', icon: Bus },
    { name: 'Incidents', path: '/incidents', icon: AlertTriangle },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-indigo-800">
          <Bus className="w-8 h-8 text-indigo-400" />
          <h1 className="text-2xl font-bold tracking-tight">EcoTransit</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-800 text-white shadow-sm' 
                    : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-indigo-800">
          <div className="flex items-center gap-3 px-4 py-3 text-indigo-200 hover:text-white cursor-pointer transition-colors rounded-lg hover:bg-indigo-800/50">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {navItems.find(i => location.pathname.startsWith(i.path))?.name || 'Admin Panel'}
          </h2>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shadow-sm">
                AD
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-700">Admin User</p>
                <p className="text-gray-500 text-xs">System Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50/50 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
