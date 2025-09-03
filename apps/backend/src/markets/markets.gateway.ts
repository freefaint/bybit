import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { BybitService } from './bybit.service';
import { SubscribePayload } from './types';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || '*' } })
export class MarketsGateway {
  @WebSocketServer() server!: Server;
  constructor(private readonly bybit: BybitService) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() body: SubscribePayload) {
    const streams = body.streams?.length ? body.streams : ['ticker', 'orderbook'];

    for (const symbol of body.symbols) {
      if (streams.includes('ticker')) {
        const topic = this.bybit.topicTicker(symbol);
        this.bybit.subscribeTopic(topic, (msg) => {
          this.server.emit('ticker', { symbol, data: msg.data });
        });
      }
      if (streams.includes('orderbook')) {
        const topic = this.bybit.topicOrderbook(symbol, 50);
        this.bybit.subscribeTopic(topic, (msg) => {
          this.server.emit('orderbook', { symbol, data: msg.data });
        });
      }
      if (streams.includes('trade')) {
        const topic = this.bybit.topicTrades(symbol);
        this.bybit.subscribeTopic(topic, (msg) => this.server.emit('trade', { symbol, data: msg.data }));
      }
      if (streams.some((s) => s.startsWith('kline'))) {
        const topic = this.bybit.topicKline(symbol, '1');
        this.bybit.subscribeTopic(topic, (msg) => this.server.emit('kline', { symbol, data: msg.data }));
      }
    }
    return { ok: true };
  }
}
