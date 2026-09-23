import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  inAppUserRoom,
  verifySocketToken,
} from './socket-auth.util';

const IN_APP_SOCKET_NAMESPACE = '/in-app';

@WebSocketGateway({
  namespace: IN_APP_SOCKET_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class InAppNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InAppNotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  handleConnection(@ConnectedSocket() client: Socket): void {
    try {
      const token = client.handshake.auth?.token;
      const payload = verifySocketToken(this.config, token);
      const room = inAppUserRoom(payload.sub);
      void client.join(room);
      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId ?? null;
    } catch (e) {
      this.logger.debug(
        `Socket rejected: ${e instanceof Error ? e.message : String(e)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    void client;
  }
}
