import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { config } from '../common/config.service';
import { Logger } from '../common/logger';
import { CategoryV5, RestClientV5, WebsocketClient } from 'bybit-api';

@Injectable()
export class BybitService implements OnModuleDestroy {
  private rest = new RestClientV5({
    key: config.bybitApiKey || undefined,
    secret: config.bybitApiSecret || undefined,
    testnet: config.bybitUseTestnet,
  });

  private ws = new WebsocketClient({
    market: 'v5',
    testnet: config.bybitUseTestnet,
  });

  private listeners = new Map<string, Set<(msg: any) => void>>(); // topic -> handlers

  constructor() {
    this.ws.on('open', ({ wsKey }) => Logger.log(`[WS] open ${wsKey}`));
    this.ws.on('response', (e) => Logger.log(`[WS] response ${JSON.stringify(e)}`));
    this.ws.on('reconnected', (e) => Logger.warn(`[WS] reconnected ${JSON.stringify(e)}`));
    this.ws.on('error', (e) => Logger.error(`[WS] error ${JSON.stringify(e)}`));

    this.ws.on('update', (update) => {
      const topic = (update as any).topic as string | undefined;
      if (!topic) return;
      const set = this.listeners.get(topic);
      if (!set) return;
      for (const fn of set) fn(update);
    });
  }

  onModuleDestroy() {
    this.ws.closeAll();
  }

  /** REST: стакан через V5 */
  async fetchOrderBook(symbol: string, depth = 50) {
    const res = await this.rest.getOrderbook({ category: config.bybitCategory, symbol, limit: depth as 50 | 200 });
    const bids = (res.result?.b || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    const asks = (res.result?.a || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    return { symbol, bids, asks, ts: Date.now() };
  }

  async fetchSymbols(): Promise<string[]> {
    const res = await this.rest.getInstrumentsInfo({
      category: config.bybitCategory, // spot | linear | inverse | option
    });
    // фильтруем только активные
    const list = (res.result?.list ?? []).filter((x: any) => (x.status ?? x.symbolStatus ?? '').toLowerCase() !== 'offline');
    return list.map((x: any) => String(x.symbol));
  }

  /** REST: исторические свечи */
  async fetchKlines(params: { symbol: string; interval: '1'|'3'|'5'|'15'|'30'|'60'|'240'|'D'; limit?: number; start?: number; end?: number; }) {
    const { symbol, interval, limit = 500, start, end } = params;

    const res = await this.rest.getKline({
      category: config.bybitCategory as any,
      symbol,
      interval,
      limit,
      start,
      end
    });

    // Bybit v5 возвращает list массивов строк: [ start, open, high, low, close, volume, turnover ]
    const list: any[] = res.result?.list || [];
    
    return list
      .map((row) => ({
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5])
      }))
     .sort((a, b) => a.time - b.time);
  }

  /** Подписка на WS V5 с категорией */
  subscribeTopic(topic: string, handler: (msg: any) => void) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(handler);

    const category = (config.bybitCategory || 'spot');
    this.ws.subscribeV5([topic], category);

    return () => this.unsubscribeTopic(topic, handler);
  }

  unsubscribeTopic(topic: string, handler: (msg: any) => void) {
    const set = this.listeners.get(topic);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(topic);
        const category = (config.bybitCategory || 'spot');
        this.ws.unsubscribeV5([topic], category);
      }
    }
  }

  // Хелперы для тем v5
  topicTicker(symbol: string) { return `tickers.${symbol}`; }
  topicOrderbook(symbol: string, depth: 50 | 200 = 50) { return `orderbook.${depth}.${symbol}`; }
  topicTrades(symbol: string) { return `publicTrade.${symbol}`; }
  topicKline(symbol: string, interval: '1' | '3' | '5' | '15' | '30' | '60') { return `kline.${interval}.${symbol}`; }
}