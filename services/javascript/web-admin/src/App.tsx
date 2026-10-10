import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Incidents from './pages/Incidents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="incidents" element={<Incidents />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
