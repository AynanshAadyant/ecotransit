import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './state/auth.store';
import ToastContainer from './components/ToastContainer';

// Layouts
import Layout from './components/Layout';
import StaffLayout from './components/StaffLayout';

// Public & Error Pages
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';

// Admin Pages
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Staff from './pages/Staff';
import RoutesPage from './pages/Routes';
import Stops from './pages/Stops';
import Incidents from './pages/Incidents';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffShift from './pages/staff/StaffShift';
import StaffReportIncident from './pages/staff/StaffReportIncident';
import StaffIncidents from './pages/staff/StaffIncidents';
import StaffProfile from './pages/staff/StaffProfile';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('ADMIN' | 'STAFF')[];
}

function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role?.toUpperCase() as 'ADMIN' | 'STAFF' | undefined;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role?.toUpperCase() === 'STAFF') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return <Navigate to="/admin/dashboard" replace />;
}

function LoginRoute() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    if (user?.role?.toUpperCase() === 'STAFF') {
      return <Navigate to="/staff/dashboard" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Login />;
}

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forbidden" element={<Forbidden />} />

        {/* Legacy redirects for direct access */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/vehicles" element={<Navigate to="/admin/vehicles" replace />} />
        <Route path="/staff-members" element={<Navigate to="/admin/staff" replace />} />

        {/* Admin Console Routes */}
        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <Layout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="staff" element={<Staff />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="stops" element={<Stops />} />
          <Route path="incidents" element={<Incidents />} />
        </Route>

        {/* Staff Portal Routes */}
        <Route
          path="/staff"
          element={
            <RoleGuard allowedRoles={['STAFF', 'ADMIN']}>
              <StaffLayout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="shift" element={<StaffShift />} />
          <Route path="incidents" element={<StaffIncidents />} />
          <Route path="incidents/report" element={<StaffReportIncident />} />
          <Route path="profile" element={<StaffProfile />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
