import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bus,
  Route as RouteIcon,
  Send,
  Loader2,
  CheckCircle2,
  LocateFixed,
} from 'lucide-react';
import { useStaffPortalStore } from '../../state/staffPortal.store';
import { fetchRoutes, type Route } from '../../api/routes.api';

const INCIDENT_TYPES = [
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'accident', label: 'Accident / Collision' },
  { value: 'traffic', label: 'Heavy Traffic Congestion' },
  { value: 'route_blockage', label: 'Route Blockage / Road Closure' },
  { value: 'gps_failure', label: 'GPS / Telemetry Device Failure' },
  { value: 'vehicle_delay', label: 'Excessive Delay / Behind Schedule' },
  { value: 'other', label: 'Other Operational Incident' },
];

export default function StaffReportIncident() {
  const navigate = useNavigate();
  const { vehicles, activeTrip, actionLoading, error, loadVehicles, reportIncident } = useStaffPortalStore();

  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [type, setType] = useState<string>('vehicle_breakdown');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [vehicleId, setVehicleId] = useState<string>(activeTrip ? String(activeTrip.vehicleId) : '');
  const [routeId, setRouteId] = useState<string>(activeTrip ? String(activeTrip.routeId) : '');
  const [description, setDescription] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [locating, setLocating] = useState<boolean>(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadVehicles();
    fetchRoutes()
      .then((data) => setAvailableRoutes(data))
      .catch(() => setAvailableRoutes([]));
  }, [loadVehicles]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setGeoMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
        setGeoMessage('Coordinates captured successfully.');
      },
      (err) => {
        setLocating(false);
        setGeoMessage(`Unable to retrieve GPS: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!description.trim()) {
      setValidationError('Please provide a detailed description of the incident.');
      return;
    }

    const payload = {
      type,
      description: description.trim(),
      severity,
      vehicleId: vehicleId ? parseInt(vehicleId, 10) : null,
      routeId: routeId ? parseInt(routeId, 10) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    };

    try {
      await reportIncident(payload);
      setSuccess(true);
      setTimeout(() => {
        navigate('/staff/incidents');
      }, 1500);
    } catch {
      // handled in store
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Report Route Incident</h1>
          <p className="text-sm text-slate-500">
            Log immediate field disruptions, mechanical faults, or emergency hazards to dispatch control.
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold">Incident submitted successfully. Redirecting to your incidents log...</p>
        </div>
      )}

      {(validationError || error) && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {validationError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
        {/* Incident Type & Severity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Incident Category *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Severity Level *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setSeverity(lvl)}
                  className={`py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                    severity === lvl
                      ? lvl === 'critical'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : lvl === 'high'
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                        : lvl === 'medium'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                        : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle & Route Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Associated Vehicle (Optional)
            </label>
            <div className="relative">
              <Bus className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">-- None / General Location --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number} ({v.registration_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Affected Transit Route (Optional)
            </label>
            <div className="relative">
              <RouteIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">-- None / Off-Route --</option>
                {availableRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.route_code || 'CODE'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* GPS Coordinates Section */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Field Coordinates (Optional)
            </label>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              Auto-Detect My GPS
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                step="any"
                placeholder="Latitude (e.g. 28.6139)"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <input
                type="number"
                step="any"
                placeholder="Longitude (e.g. 77.2090)"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>
          {geoMessage && <p className="text-xs text-slate-500">{geoMessage}</p>}
        </div>

        {/* Description */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Detailed Incident Description *
          </label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the nature of the disruption, passenger safety status, obstruction details, and estimated turnaround..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={actionLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md shadow-amber-600/30 transition-all disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Report to Control
          </button>
        </div>
      </form>
    </div>
  );
}
