import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('NotificationsGateway');
  private readonly connectedClients = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token?.split(' ')[1];
      if (!token) {
        this.disconnect(client);
        return;
      }

      const decoded = this.jwtService.verify(token);
      const { sub: userId, warehouseId } = decoded;

      if (!userId || !warehouseId) {
        this.disconnect(client);
        return;
      }

      client.data.userId = userId;
      client.data.warehouseId = warehouseId;

      if (!this.connectedClients.has(warehouseId)) {
        this.connectedClients.set(warehouseId, new Set());
      }
      this.connectedClients.get(warehouseId).add(client.id);

      await client.join(`warehouse:${warehouseId}`);
      this.logger.log(
        `Client connected: ${client.id} for warehouse: ${warehouseId}`
      );
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      this.disconnect(client);
    }
  }

  handleDisconnect(client: Socket) {
    const { warehouseId } = client.data;
    if (warehouseId) {
      const warehouseClients = this.connectedClients.get(warehouseId);
      if (warehouseClients) {
        warehouseClients.delete(client.id);
        if (warehouseClients.size === 0) {
          this.connectedClients.delete(warehouseId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string }
  ) {
    try {
      const { warehouseId } = client.data;
      await this.notificationsService.markAsRead(
        data.notificationId,
        warehouseId
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private disconnect(client: Socket) {
    client.emit('error', 'Unauthorized');
    client.disconnect();
  }

  // Method to emit notifications to specific warehouse
  async emitToWarehouse(warehouseId: string, event: string, data: any) {
    this.server.to(`warehouse:${warehouseId}`).emit(event, data);
  }
}
