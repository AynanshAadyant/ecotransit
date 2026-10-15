import { io, Socket } from 'socket.io-client';
import { Vehicle, TelemetryFrame } from '@ecotransit/contracts';

type TelemetryCallback = (vehicles: Record<string, Vehicle>, timestamp: number) => void;
type ConnectionStatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

let socket: Socket | null = null;
let telemetryListener: TelemetryCallback | null = null;
let statusListener: ConnectionStatusCallback | null = null;

// Telemetry coalescing buffer
let pendingVehiclesBuffer: Record<string, Vehicle> = {};
let pendingTimestamp = 0;
let rafScheduleId: number | null = null;

function flushBuffer() {
  if (telemetryListener && Object.keys(pendingVehiclesBuffer).length > 0) {
    telemetryListener({ ...pendingVehiclesBuffer }, pendingTimestamp);
    pendingVehiclesBuffer = {};
  }
  rafScheduleId = null;
}

/**
 * Spec §10.2:
 * Incoming telemetry frames from socket.ts must be coalesced and flushed
 * once per animation frame, not applied to the store per message.
 */
function handleIncomingFrame(data: TelemetryFrame | Vehicle[] | Vehicle) {
  let vehiclesList: Vehicle[] = [];
  let frameTime = Date.now();

  if (Array.isArray(data)) {
    vehiclesList = data;
  } else if ('vehicles' in data && Array.isArray((data as TelemetryFrame).vehicles)) {
    vehiclesList = (data as TelemetryFrame).vehicles;
    frameTime = (data as TelemetryFrame).timestamp || frameTime;
  } else if ('vehicleId' in data) {
    vehiclesList = [data as Vehicle];
  }

  // Accumulate into frame buffer
  for (const v of vehiclesList) {
    pendingVehiclesBuffer[v.vehicleId] = v;
  }
  pendingTimestamp = frameTime;

  // Schedule flush on next animation frame if not already scheduled
  if (rafScheduleId === null) {
    rafScheduleId = requestAnimationFrame(flushBuffer);
  }
}

export function initTransitSocket(
  onTelemetry: TelemetryCallback,
  onStatusChange: ConnectionStatusCallback
) {
  telemetryListener = onTelemetry;
  statusListener = onStatusChange;

  if (socket) {
    return socket;
  }

  const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

  socket = io(socketUrl, {
    path: '/events/telemetry',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    statusListener?.('connected');
  });

  socket.on('disconnect', () => {
    statusListener?.('disconnected');
  });

  socket.io.on('reconnect_attempt', () => {
    statusListener?.('reconnecting');
  });

  socket.io.on('reconnect', () => {
    statusListener?.('connected');
  });

  // Telemetry frame event listener (5-second cadence per spec §10.2)
  socket.on('telemetry:frame', handleIncomingFrame);
  socket.on('vehicle:update', handleIncomingFrame);

  return socket;
}

export function disconnectTransitSocket() {
  if (rafScheduleId !== null) {
    cancelAnimationFrame(rafScheduleId);
    rafScheduleId = null;
  }
  pendingVehiclesBuffer = {};
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
