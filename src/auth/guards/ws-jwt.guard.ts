import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token?.split(' ')[1];

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = this.jwtService.verify(token);
      const { sub: userId, shopId } = payload;

      if (!userId || !shopId) {
        throw new WsException('Invalid token payload');
      }

      // Attach decoded data to client for use in handlers
      client.data.userId = userId;
      client.data.shopId = shopId;

      return true;
    } catch (error) {
      throw new WsException(error.message);
    }
  }
}
