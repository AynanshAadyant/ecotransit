import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface VehicleLocationPayload {
  vehicleId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
}

export interface VehicleStatusPayload {
  vehicleId: number;
  status: 'active' | 'maintenance' | 'inactive' | 'offline' | string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export function getSocketUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  return 'http://localhost:5000';
}

export function initSocket(token?: string | null): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const wsUrl = getSocketUrl();
  const authToken = token || localStorage.getItem('token') || undefined;

  socket = io(wsUrl, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    autoConnect: true,
  });

  return socket;
}

export function getActiveSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
