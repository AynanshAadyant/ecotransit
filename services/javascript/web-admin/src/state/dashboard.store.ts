import { create } from 'zustand';
import { fetchDashboard as fetchDashboardApi, type DashboardData } from '../api/dashboard.api';
import {
  initSocket,
  disconnectSocket,
  getActiveSocket,
  type VehicleLocationPayload,
  type VehicleStatusPayload,
} from '../api/socket';

export interface LiveEventItem {
  id: string;
  type: 'telemetry' | 'status' | 'incident' | 'trip';
  summary: string;
  time: string;
}

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  connectionMode: 'websocket' | 'polling' | 'connecting' | 'disconnected';
  lastTelemetryTime: string | null;
  recentLiveEvents: LiveEventItem[];
  fetchDashboard: () => Promise<void>;
  startLiveStream: () => void;
  stopLiveStream: () => void;
}

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  wsConnected: false,
  connectionMode: 'disconnected',
  lastTelemetryTime: null,
  recentLiveEvents: [],

  fetchDashboard: async () => {
    set({ loading: !get().data, error: null });
    try {
      const data = await fetchDashboardApi();
      set({ data, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      set({ error: message, loading: false });
    }
  },

  startLiveStream: () => {
    // Initial fetch
    get().fetchDashboard();

    // Start Socket connection
    set({ connectionMode: 'connecting' });
    const socket = initSocket();

    const addEvent = (type: LiveEventItem['type'], summary: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const time = new Date().toLocaleTimeString();
      set((state) => ({
        lastTelemetryTime: time,
        recentLiveEvents: [{ id, type, summary, time }, ...state.recentLiveEvents].slice(0, 10),
      }));
    };

    socket.on('connect', () => {
      set({ wsConnected: true, connectionMode: 'websocket', error: null });
      addEvent('telemetry', 'WebSocket channel established with dispatch server');
      // Request admin room join
      const token = localStorage.getItem('token');
      if (token) {
        socket.emit('authenticate', { token });
      }
    });

    socket.on('disconnect', (reason) => {
      set({ wsConnected: false, connectionMode: 'polling' });
      addEvent('status', `Stream disconnected (${reason}). Switched to automatic polling fallback.`);
    });

    socket.on('connect_error', () => {
      set({ wsConnected: false, connectionMode: 'polling' });
    });

    // Real-time Vehicle Location Frame
    socket.on('vehicle:location_updated', (payload: VehicleLocationPayload) => {
      addEvent('telemetry', `Vehicle #${payload.vehicleId} ping at ${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}`);
    });

    // Real-time Vehicle Status
    socket.on('vehicle:status_changed', (payload: VehicleStatusPayload) => {
      addEvent('status', `Vehicle #${payload.vehicleId} status transitioned to "${payload.status.toUpperCase()}"`);
      // Trigger metric re-fetch to keep counts accurate
      get().fetchDashboard();
    });

    // Real-time Vehicle Offline
    socket.on('vehicle:offline', (payload: VehicleStatusPayload) => {
      addEvent('status', `Vehicle #${payload.vehicleId} reported offline / signal lost`);
      get().fetchDashboard();
    });

    // Real-time Incident Created
    socket.on('incident:created', (incident: { id: number; type: string; description: string }) => {
      addEvent('incident', `New Incident #${incident.id} reported: ${incident.type.replace(/_/g, ' ')}`);
      set((state) => {
        if (!state.data) return state;
        return {
          data: {
            ...state.data,
            openIncidents: (state.data.openIncidents || 0) + 1,
          },
        };
      });
      get().fetchDashboard();
    });

    // Real-time Incident Updated
    socket.on('incident:updated', (incident: { id: number; status: string }) => {
      addEvent('incident', `Incident #${incident.id} updated (${incident.status.replace(/_/g, ' ')})`);
      get().fetchDashboard();
    });

    // Real-time Trip Lifecycle
    socket.on('trip:started', (trip: { id: number; vehicleNumber?: string }) => {
      addEvent('trip', `Trip #${trip.id} started on vehicle ${trip.vehicleNumber || 'Unit'}`);
      get().fetchDashboard();
    });

    socket.on('trip:completed', (trip: { id: number; vehicleNumber?: string }) => {
      addEvent('trip', `Trip #${trip.id} completed on vehicle ${trip.vehicleNumber || 'Unit'}`);
      get().fetchDashboard();
    });

    // Polling fallback loop: runs every 10 seconds if websocket is down, or every 30s as background sync
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    pollingTimer = setInterval(() => {
      const currentMode = get().connectionMode;
      if (currentMode === 'polling' || !get().wsConnected) {
        get().fetchDashboard();
      }
    }, 10000);
  },

  stopLiveStream: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    const socket = getActiveSocket();
    if (socket) {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('vehicle:location_updated');
      socket.off('vehicle:status_changed');
      socket.off('vehicle:offline');
      socket.off('incident:created');
      socket.off('incident:updated');
      socket.off('trip:started');
      socket.off('trip:completed');
    }
    disconnectSocket();
    set({ wsConnected: false, connectionMode: 'disconnected' });
  },
}));
