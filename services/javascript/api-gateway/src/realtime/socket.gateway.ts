import type { Server, Socket } from 'socket.io';
import { createLogger } from '@ecotransit/core-utils';
import type { ISocketGateway, TelemetryBatchFrame } from '@ecotransit/contracts';

const logger = createLogger('api-gateway:socket-gateway');

export class SocketGateway implements ISocketGateway {
  private activeClients = 0;

  constructor(private readonly io: Server) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      this.activeClients++;
      logger.info({ socketId: socket.id, activeClients: this.activeClients }, 'Client connected to socket gateway');

      socket.on('subscribe_route', (routeId: string) => {
        if (typeof routeId === 'string' && routeId.trim()) {
          const room = `route:${routeId.trim()}`;
          socket.join(room);
          logger.debug({ socketId: socket.id, room }, 'Client joined route room');
        }
      });

      socket.on('unsubscribe_route', (routeId: string) => {
        if (typeof routeId === 'string' && routeId.trim()) {
          const room = `route:${routeId.trim()}`;
          socket.leave(room);
          logger.debug({ socketId: socket.id, room }, 'Client left route room');
        }
      });

      socket.on('disconnect', () => {
        this.activeClients = Math.max(0, this.activeClients - 1);
        logger.info({ socketId: socket.id, activeClients: this.activeClients }, 'Client disconnected from socket gateway');
      });
    });
  }

  broadcast(frame: TelemetryBatchFrame): void {
    if (this.activeClients === 0) return;

    // Emits telemetry_frame event and telemetry:batch alias to all connected sockets
    this.io.emit('telemetry_frame', frame);
    this.io.emit('telemetry:batch', frame);

    // Also dispatch to specific route rooms if vehicles belong to routes
    for (const vehicle of frame.vehicles) {
      if (vehicle.routeId) {
        this.io.to(`route:${vehicle.routeId}`).emit('vehicle_update', vehicle);
      }
    }
  }

  connectionCount(): number {
    return this.activeClients;
  }
}
