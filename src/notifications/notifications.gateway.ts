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
      const { sub: userId, shopId } = decoded;

      if (!userId || !shopId) {
        this.disconnect(client);
        return;
      }

      client.data.userId = userId;
      client.data.shopId = shopId;

      if (!this.connectedClients.has(shopId)) {
        this.connectedClients.set(shopId, new Set());
      }
      this.connectedClients.get(shopId).add(client.id);

      await client.join(`shop:${shopId}`);
      this.logger.log(`Client connected: ${client.id} for shop: ${shopId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      this.disconnect(client);
    }
  }

  handleDisconnect(client: Socket) {
    const { shopId } = client.data;
    if (shopId) {
      const shopClients = this.connectedClients.get(shopId);
      if (shopClients) {
        shopClients.delete(client.id);
        if (shopClients.size === 0) {
          this.connectedClients.delete(shopId);
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
      const { shopId } = client.data;
      await this.notificationsService.markAsRead(data.notificationId, shopId);
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

  // Method to emit notifications to specific shop
  async emitToShop(shopId: string, event: string, data: any) {
    this.server.to(`shop:${shopId}`).emit(event, data);
  }
}
