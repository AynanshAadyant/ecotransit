import { io, Socket } from 'socket.io-client';
import {
  Vehicle,
  VehiclePosition,
  TelemetryBatchFrameSchema,
  VehiclePositionSchema,
} from '@ecotransit/contracts';

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
 * Normalizes a VehiclePosition (from backend) to the frontend Vehicle contract
 */
function normalizeVehicle(v: VehiclePosition | Vehicle): Vehicle {
  const bearing = 'bearing' in v && v.bearing !== undefined ? v.bearing : ('heading' in v ? (v as Vehicle).heading : undefined);
  const occupancy = 'occupancyStatus' in v ? (v as Vehicle).occupancyStatus : undefined;

  return {
    vehicleId: v.vehicleId,
    routeId: v.routeId || '',
    latitude: v.latitude,
    longitude: v.longitude,
    speed: v.speed,
    heading: bearing,
    occupancyStatus: occupancy,
    timestamp: typeof v.timestamp === 'number' ? new Date(v.timestamp * 1000).toISOString() : (v.timestamp || new Date().toISOString()),
  };
}

/**
 * Spec §10.2:
 * Incoming telemetry frames from socket.ts must be coalesced and flushed
 * once per animation frame, not applied to the store per message.
 * Also performs Zero-Trust validation on incoming payloads before committing to state.
 */
function handleIncomingFrame(data: unknown) {
  let vehiclesList: (VehiclePosition | Vehicle)[] = [];
  let frameTime = Date.now();

  // Try validating as standard TelemetryBatchFrame
  const parsedBatch = TelemetryBatchFrameSchema.safeParse(data);
  if (parsedBatch.success) {
    vehiclesList = parsedBatch.data.vehicles;
    frameTime = parsedBatch.data.timestamp * 1000;
  } else if (Array.isArray(data)) {
    for (const item of data) {
      const parsedPos = VehiclePositionSchema.safeParse(item);
      if (parsedPos.success) {
        vehiclesList.push(parsedPos.data);
      } else if (item && typeof item === 'object' && 'vehicleId' in item) {
        vehiclesList.push(item as Vehicle);
      }
    }
  } else if (data && typeof data === 'object') {
    if ('vehicles' in data && Array.isArray((data as { vehicles: unknown[] }).vehicles)) {
      const rawVehicles = (data as { vehicles: unknown[] }).vehicles;
      for (const item of rawVehicles) {
        const parsedPos = VehiclePositionSchema.safeParse(item);
        if (parsedPos.success) {
          vehiclesList.push(parsedPos.data);
        } else if (item && typeof item === 'object' && 'vehicleId' in item) {
          vehiclesList.push(item as Vehicle);
        }
      }
      if ('timestamp' in data && typeof (data as { timestamp: number }).timestamp === 'number') {
        const t = (data as { timestamp: number }).timestamp;
        frameTime = t > 1e11 ? t : t * 1000;
      }
    } else if ('vehicleId' in data) {
      const parsedPos = VehiclePositionSchema.safeParse(data);
      if (parsedPos.success) {
        vehiclesList.push(parsedPos.data);
      } else {
        vehiclesList.push(data as Vehicle);
      }
    }
  }

  if (vehiclesList.length === 0) {
    return;
  }

  // Accumulate normalized vehicles into frame buffer
  for (const rawV of vehiclesList) {
    const v = normalizeVehicle(rawV);
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
    if (socket.connected) {
      statusListener('connected');
    }
    return socket;
  }

  const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const socketUrl = import.meta.env['VITE_WS_URL'] || `http://${defaultHost}:4000`;
  const socketPath = import.meta.env['VITE_WS_PATH'] || '/socket.io';

  console.log('[Transit Socket] Connecting to:', socketUrl, 'path:', socketPath);

  socket = io(socketUrl, {
    path: socketPath,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['polling', 'websocket'],
  });

  socket.on('connect', () => {
    console.log('[Transit Socket] Connected! Socket ID:', socket?.id);
    statusListener?.('connected');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Transit Socket] Disconnected. Reason:', reason);
    statusListener?.('disconnected');
  });

  socket.on('connect_error', (error) => {
    console.warn('[Transit Socket] Connection error:', error.message);
    statusListener?.('disconnected');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('[Transit Socket] Reconnect attempt #', attempt);
    statusListener?.('reconnecting');
  });

  socket.io.on('reconnect', () => {
    console.log('[Transit Socket] Reconnected successfully!');
    statusListener?.('connected');
  });

  // Listen for both backend event names (telemetry_frame, telemetry:batch, vehicle_update)
  socket.on('telemetry_frame', handleIncomingFrame);
  socket.on('telemetry:batch', handleIncomingFrame);
  socket.on('telemetry:frame', handleIncomingFrame);
  socket.on('vehicle_update', handleIncomingFrame);
  socket.on('vehicle:update', handleIncomingFrame);

  return socket;
}

export function subscribeToRoute(routeId: string) {
  if (socket && socket.connected && routeId.trim()) {
    socket.emit('subscribe_route', routeId.trim());
  }
}

export function unsubscribeFromRoute(routeId: string) {
  if (socket && socket.connected && routeId.trim()) {
    socket.emit('unsubscribe_route', routeId.trim());
  }
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
