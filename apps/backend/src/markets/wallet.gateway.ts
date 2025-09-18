// wallet.gateway.ts
import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BybitService } from './bybit.service';
import { Logger } from '../common/logger';
import { Subscription } from 'rxjs';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || '*' }})
export class WalletGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() io!: Server;

  constructor(private readonly bybit: BybitService) {}

  private clientSubs = new Map<string, Subscription>(); // socket.id -> rx sub
  private subscribersCount = 0;

  async handleConnection(client: Socket) {
    Logger.log(`[SOCKET] connected ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.dropClient(client);
    Logger.log(`[SOCKET] disconnected ${client.id}`);
  }

  @SubscribeMessage('wallet:subscribe')
  async onWalletSubscribe(@ConnectedSocket() client: Socket) {
    // лениво стартуем приватный фид один раз на процесс
    await this.bybit.ensureWalletFeed({ wsCategory: 'unified' });

    // сразу отправим снапшот, если есть
    const snap = this.bybit.getWalletSnapshot();
    if (snap) client.emit('wallet:update', snap);

    // и подпишем клиента на будущие апдейты
    const sub = this.bybit.watchWallet().subscribe((state) => {
      if (state) client.emit('wallet:update', state);
    });

    this.clientSubs.set(client.id, sub);
    this.subscribersCount++;
    return { ok: true };
  }

  @SubscribeMessage('wallet:unsubscribe')
  async onWalletUnsubscribe(@ConnectedSocket() client: Socket) {
    this.dropClient(client);
    return { ok: true };
  }

  private dropClient(client: Socket) {
    const sub = this.clientSubs.get(client.id);
    if (sub) sub.unsubscribe();
    this.clientSubs.delete(client.id);
    if (this.subscribersCount > 0) this.subscribersCount--;
  }
}