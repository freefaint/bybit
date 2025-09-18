// bybit.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { config } from '../common/config.service';
import { Logger } from '../common/logger';
import { CategoryV5, RestClientV5, WebsocketClient } from 'bybit-api';
import { BehaviorSubject, Subscription } from 'rxjs';

type Handler = (msg: any) => void;

type WalletCoin = {
  coin: string;
  walletBalance: number;
  availableBalance: number;
  equity: number;
  unrealisedPnl: number;
  borrowed?: number;
};

type WalletState = {
  ts: number;
  byCoin: Record<string, WalletCoin>;
};

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
    // важное: приватка нужна для wallet
    key: config.bybitApiKey || undefined,
    secret: config.bybitApiSecret || undefined,
  });

  /** topic -> handlers (общая шина) */
  private listeners = new Map<string, Set<Handler>>();
  /** активные подписки по категории */
  private activeSubs = new Map<CategoryV5 | 'unified', Set<string>>();

  /** --- ХРАНИЛКА БАЛАНСА --- */
  private wallet$ = new BehaviorSubject<WalletState | null>(null);
  private walletFeedStarted = false;

  private get category(): CategoryV5 {
    return (config.bybitCategory || 'spot') as CategoryV5;
  }

  constructor() {
    this.ws.on('open', ({ wsKey }) => Logger.log(`[WS] open ${wsKey}`));

    this.ws.on('response', (e: any) => {
      if (e?.success === false && /already subscribed/i.test(e?.ret_msg ?? '')) {
        Logger.warn(`[WS] already subscribed: ${e.ret_msg}`);
        return;
      }
      Logger.log(`[WS] response ${JSON.stringify(e)}`);
    });

    this.ws.on('reconnected', (e) => {
      Logger.warn(`[WS] reconnected ${JSON.stringify(e)}`);
      this.resubscribeAll();
    });

    this.ws.on('error', (e) => Logger.error(`[WS] error ${JSON.stringify(e)}`));

    this.ws.on('update', (update: any) => {
      const topic: string | undefined = update?.topic;
      if (!topic) return;

      // прокидываем слушателям конкретного топика
      const set = this.listeners.get(topic);
      if (set?.size) for (const fn of set) fn(update);

      // если это приватный wallet — обновим хранилку
      if (topic === 'wallet') this.ingestWalletUpdate(update);
    });
  }

  onModuleDestroy() {
    try { this.ws.closeAll(); } catch {}
  }

  /** ------------------------ REST ------------------------ */

  async fetchOrderBook(symbol: string, depth = 50) {
    const res = await this.rest.getOrderbook({
      category: this.category,
      symbol,
      limit: (depth as 50 | 200),
    });
    const bids = (res.result?.b || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    const asks = (res.result?.a || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    return { symbol, bids, asks, ts: Date.now() };
  }

  async fetchSymbols(): Promise<string[]> {
    const res = await this.rest.getInstrumentsInfo({ category: this.category });
    const list = (res.result?.list ?? []).filter(
      (x: any) => (x.status ?? x.symbolStatus ?? '').toLowerCase() !== 'offline',
    );
    return list.map((x: any) => String(x.symbol));
  }

  async fetchKlines(params: {
    symbol: string; interval: '1'|'3'|'5'|'15'|'30'|'60'|'240'|'D'; limit?: number; start?: number; end?: number;
  }) {
    const { symbol, interval, limit = 500, start, end } = params;
    const res = await this.rest.getKline({ category: this.category as 'linear' | 'spot' | 'inverse', symbol, interval, limit, start, end });
    const list: any[] = res.result?.list || [];
    return list.map((row) => ({
      time: +row[0], open: +row[1], high: +row[2], low: +row[3], close: +row[4], volume: +row[5],
    })).sort((a, b) => a.time - b.time);
  }

  /** ------------------------ WS (pub) ------------------------ */

  subscribeTopic(topic: string, handler: Handler) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(handler);

    const cat = this.category;
    const catSet = this.ensureCatSet(cat);
    if (!catSet.has(topic)) {
      catSet.add(topic);
      this.safeSubscribe([topic], cat);
    }
    return () => this.unsubscribeTopic(topic, handler);
  }

  unsubscribeTopic(topic: string, handler: Handler) {
    const set = this.listeners.get(topic);
    if (!set) return;
    set.delete(handler);

    if (set.size === 0) {
      this.listeners.delete(topic);
      const cat = this.category;
      const catSet = this.ensureCatSet(cat);
      if (catSet.has(topic)) {
        catSet.delete(topic);
        this.safeUnsubscribe([topic], cat);
      }
    }
  }

  topicTicker(symbol: string) { return `tickers.${symbol}`; }
  topicOrderbook(symbol: string, depth: 50 | 200 = 50) { return `orderbook.${depth}.${symbol}`; }
  topicTrades(symbol: string) { return `publicTrade.${symbol}`; }
  topicKline(symbol: string, interval: '1'|'3'|'5'|'15'|'30'|'60') { return `kline.${interval}.${symbol}`; }

  /** ------------------------ WS (private wallet) ------------------------ */

  /** Запустить внутреннюю подписку на баланс (один раз на процесс). */
  async ensureWalletFeed(opts?: { wsCategory?: 'unified' | 'linear' | 'inverse' | 'spot' }) {
    if (this.walletFeedStarted) return;
    this.walletFeedStarted = true;

    // 1) стянем начальный снапшот через REST
    // try {
    //   const { byCoin } = await this.getBalanceREST({ accountType: 'UNIFIED' });
      
    //   this.wallet$.next({ ts: Date.now(), byCoin });
    // } catch (e) {
    //   Logger.warn(`[WALLET] initial REST failed: ${String(e)}`);
    // }

    setInterval(async () => {
      try {
        const { byCoin } = await this.getBalanceREST({ accountType: 'UNIFIED' });
        
        this.wallet$.next({ ts: Date.now(), byCoin });
      } catch (e) {
        Logger.warn(`[WALLET] initial REST failed: ${String(e)}`);
      }
    }, 2000);

    // 2) подпишемся на приватный wallet
    const topic = 'wallet';
    const cat = (opts?.wsCategory ?? 'unified') as any;

    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    const catSet = this.ensureCatSet(cat);
    if (!catSet.has(topic)) {
      catSet.add(topic);
      this.safeSubscribe([topic], cat);
    }
    Logger.log('[WALLET] feed started');
  }

  /** Текущее состояние баланса (снапшот из памяти). */
  getWalletSnapshot(): WalletState | null {
    return this.wallet$.value;
  }

  /** Подписка на изменения баланса (Rx). */
  watchWallet() {
    return this.wallet$.asObservable();
  }

  /** ------------------------ Internal helpers ------------------------ */

  private ensureCatSet(cat: CategoryV5 | 'unified'): Set<string> {
    if (!this.activeSubs.has(cat)) this.activeSubs.set(cat, new Set());
    return this.activeSubs.get(cat)!;
  }

  private safeSubscribe(topics: string[], category: CategoryV5 | 'unified') {
    try {
      this.ws.subscribeV5(topics as any, category as any);
      Logger.log(`[WS] subscribe ${String(category)}: ${topics.join(', ')}`);
    } catch (e) {
      Logger.error(`[WS] subscribe failed: ${String(e)}`);
    }
  }

  private safeUnsubscribe(topics: string[], category: CategoryV5 | 'unified') {
    try {
      this.ws.unsubscribeV5(topics as any, category as any);
      Logger.log(`[WS] unsubscribe ${String(category)}: ${topics.join(', ')}`);
    } catch (e) {
      Logger.error(`[WS] unsubscribe failed: ${String(e)}`);
    }
  }

  private resubscribeAll() {
    for (const [cat, set] of this.activeSubs.entries()) {
      if (!set.size) continue;
      this.safeSubscribe([...set], cat);
    }
  }

  private ingestWalletUpdate(update: any) {
    // формат Bybit: { topic:'wallet', data:[ { coin:'USDT', walletBalance:'...', ... }, ... ] }
    const prev = this.wallet$.value ?? { ts: 0, byCoin: {} as Record<string, WalletCoin> };
    const byCoin = { ...prev.byCoin };

    const arr: any[] = Array.isArray(update?.data) ? update.data : [];
    for (const d of arr) {
      const c = String(d.coin);
      byCoin[c] = {
        coin: c,
        walletBalance: Number(d.walletBalance ?? 0),
        availableBalance: Number(d.availableBalance ?? 0),
        equity: Number(d.equity ?? 0),
        unrealisedPnl: Number(d.unrealisedPnl ?? 0),
        borrowed: d.borrowAmount != null ? Number(d.borrowAmount) : undefined,
      };
    }

    this.wallet$.next({ ts: Date.now(), byCoin });
  }

  /** REST-обёртка для начального снапшота */
  private async getBalanceREST(params?: { accountType?: 'UNIFIED' | 'CONTRACT' | 'SPOT'; coin?: string }) {
    const accountType = params?.accountType ?? 'UNIFIED';
    const coin = params?.coin;

    const res = await this.rest.getWalletBalance({ accountType, ...(coin ? { coin } : {}) });

    const out: Record<string, WalletCoin> = {};
    for (const acct of res.result?.list ?? []) {
      for (const d of acct?.coin ?? []) {
        const c = String(d.coin);
        out[c] = {
          coin: c,
          walletBalance: Number(d.walletBalance ?? 0),
          availableBalance: Number(d.availableToWithdraw ?? 0),
          equity: Number(d.equity ?? 0),
          unrealisedPnl: Number(d.unrealisedPnl ?? 0),
          borrowed: d.borrowAmount != null ? Number(d.borrowAmount) : undefined,
        };
      }
    }
    return { byCoin: out };
  }

  async getOpenOrders(category = 'linear', symbol?: string) {
    try {
      // SDK: getActiveOrders -> maps to GET /v5/order/realtime
      const params: any = { category, openOnly: 1 };
      if (symbol) params.symbol = symbol;

      const res = await this.rest.getActiveOrders({ ...params, settleCoin: "USDT" });
      // res обычно содержит { ret_code, ret_msg, result, time_now } или уже распарсенный result
      // Проверь структуру в своём SDK (логируем для разработки)
      Logger.debug('Bybit getOpenOrders result', res);
      return res;
    } catch (err) {
      Logger.error('Failed to fetch open orders', err);
      throw err;
    }
  }

  async getOpenPositions(category = 'linear', symbol?: string) {
    try {
      // В официальной доке endpoint: GET /v5/position/list
      const params: any = { category };
      // Важное: для некоторых категорий Bybit требует либо symbol, либо settleCoin — если не передаёшь, вернётся ошибка.
      if (symbol) params.symbol = symbol;

      // SDK-метод может называться getPositionList / getPositions / getPositionsList — попробуй эти имена,
      // но обычно в SDK есть функция, которая маппится на /v5/position/list.
      // Пробуем общепринятое имя:
      const res = await this.rest.getPositionInfo({ ...params, settleCoin: "USDT" })

      Logger.debug('Bybit getOpenPositions result', res);
      return res;
    } catch (err) {
      Logger.error('Failed to fetch positions', err);
      throw err;
    }
  }
}