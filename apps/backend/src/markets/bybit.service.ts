// bybit.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { config } from '../common/config.service';
import { Logger } from '../common/logger';
import { CategoryV5, RestClientV5, WebsocketClient } from 'bybit-api';
import { BehaviorSubject } from 'rxjs';

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
    // приватка для wallet/ордеров/позиций
    key: config.bybitApiKey || undefined,
    secret: config.bybitApiSecret || undefined,
  });

  /** topic -> handlers (общая шина) */
  private listeners = new Map<string, Set<Handler>>();

  /** Реестр подписок по фактическому wsKey (v5LinearPublic, v5UnifiedPrivate, ...) */
  private subsByWsKey = new Map<string, Set<string>>();
  private resubLock = false;

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
      void this.resubscribeAll();
    });

    this.ws.on('error', (e: any) => {
      const msg = String(e?.ret_msg ?? e?.message ?? e ?? '');
      if (/already subscribed/i.test(msg)) {
        Logger.warn(`[WS] already subscribed (downgraded): ${msg}`);
        return;
      }
      Logger.error(`[WS] error ${JSON.stringify(e)}`);
    });

    this.ws.on('update', (update: any) => {
      const topic: string | undefined = update?.topic;
      if (!topic) return;

      // прокидываем слушателям конкретного топика
      const set = this.listeners.get(topic);
      if (set?.size) for (const fn of set) fn(update);

      // если это приватный wallet — обновим хранилку
      if (topic === 'wallet') this.ingestWalletUpdate(update);
    });

    // чтобы странные отклонённые промисы не валили процесс
    process.on('unhandledRejection', (reason: any) => {
      const msg = String((reason as any)?.message ?? reason ?? '');
      if (/already subscribed/i.test(msg)) {
        Logger.warn(`[WS] swallowed unhandledRejection: ${msg}`);
        return;
      }
      Logger.error(`[WS] unhandledRejection: ${msg}`);
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

  /** ------------------------ WS topic builders ------------------------ */

  topicTicker(symbol: string) { return `tickers.${symbol}`; }
  topicOrderbook(symbol: string, depth: 50 | 200 = 50) { return `orderbook.${depth}.${symbol}`; }
  topicTrades(symbol: string) { return `publicTrade.${symbol}`; }
  topicKline(symbol: string, interval: '1'|'3'|'5'|'15'|'30'|'60') { return `kline.${interval}.${symbol}`; }

  /** ------------------------ WS subscribe helpers ------------------------ */

  private wsKeyFor(category: CategoryV5 | 'unified', isPrivate = false): string {
    if (category === 'unified') return 'v5UnifiedPrivate';
    const cap = String(category)[0].toUpperCase() + String(category).slice(1);
    return `v5${cap}${isPrivate ? 'Private' : 'Public'}`;
  }

  private ensureWsSet(wsKey: string): Set<string> {
    if (!this.subsByWsKey.has(wsKey)) this.subsByWsKey.set(wsKey, new Set());
    return this.subsByWsKey.get(wsKey)!;
  }

  private hasSub(wsKey: string, topic: string) {
    return this.subsByWsKey.get(wsKey)?.has(topic) ?? false;
  }
  private markSub(wsKey: string, topic: string) {
    this.ensureWsSet(wsKey).add(topic);
  }
  private unmarkSub(wsKey: string, topic: string) {
    this.subsByWsKey.get(wsKey)?.delete(topic);
  }

  private async safeSubscribe(topics: string[], category: CategoryV5 | 'unified', isPrivate = false) {
    const wsKey = this.wsKeyFor(category, isPrivate);
    const need = topics.filter(t => !this.hasSub(wsKey, t));
    if (need.length === 0) {
      Logger.debug(`[WS] skip dup subscribe ${wsKey}: (no new topics)`);
      return;
    }

    try {
      await this.ws.subscribeV5(need as any, category as any);
      need.forEach(t => this.markSub(wsKey, t));
      Logger.log(`[WS] subscribe ${wsKey}: ${need.join(', ')}`);
    } catch (e: any) {
      const msg = String(e?.ret_msg ?? e?.message ?? e ?? '');
      if (/already subscribed/i.test(msg)) {
        Logger.warn(`[WS] already subscribed -> OK ${wsKey}: ${need.join(', ')}`);
        need.forEach(t => this.markSub(wsKey, t));
        return;
      }
      Logger.error(`[WS] subscribe failed ${wsKey}: ${msg}`);
      throw e;
    }
  }

  private async safeUnsubscribe(topics: string[], category: CategoryV5 | 'unified', isPrivate = false) {
    const wsKey = this.wsKeyFor(category, isPrivate);
    const present = topics.filter(t => this.hasSub(wsKey, t));
    if (present.length === 0) {
      Logger.debug(`[WS] skip unsubscribe ${wsKey}: (nothing tracked)`);
      return;
    }

    try {
      await this.ws.unsubscribeV5(present as any, category as any);
      present.forEach(t => this.unmarkSub(wsKey, t));
      Logger.log(`[WS] unsubscribe ${wsKey}: ${present.join(', ')}`);
    } catch (e: any) {
      const msg = String(e?.ret_msg ?? e?.message ?? e ?? '');
      if (/not subscribed/i.test(msg)) {
        Logger.warn(`[WS] not subscribed -> OK ${wsKey}: ${present.join(', ')}`);
        present.forEach(t => this.unmarkSub(wsKey, t));
        return;
      }
      Logger.error(`[WS] unsubscribe failed ${wsKey}: ${msg}`);
    }
  }

  private async resubscribeAll() {
    if (this.resubLock) return;
    this.resubLock = true;
    try {
      for (const [wsKey, topics] of this.subsByWsKey.entries()) {
        if (!topics.size) continue;
        const isPrivate = /Private$/.test(wsKey);
        const cat = wsKey.includes('Unified')
          ? 'unified'
          : wsKey.includes('Linear')
          ? 'linear'
          : wsKey.includes('Inverse')
          ? 'inverse'
          : 'spot';

        for (const topic of topics) {
          try {
            await this.safeSubscribe([topic], cat as any, isPrivate);
            await new Promise(r => setTimeout(r, 50)); // мягкий троттлинг
          } catch (e) {
            Logger.error(`[WS] resubscribe failed ${wsKey}:${topic} -> ${String((e as any)?.message ?? e)}`);
          }
        }
      }
    } finally {
      this.resubLock = false;
    }
  }

  /** ------------------------ Публичные подписки ------------------------ */

  subscribeTopic(topic: string, handler: Handler) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(handler);

    const cat = this.category; // публичные фиды
    const wsKey = this.wsKeyFor(cat, false);
    const set = this.ensureWsSet(wsKey);

    if (!set.has(topic)) {
      void this.safeSubscribe([topic], cat, false).catch(err => {
        Logger.error(`[WS] subscribeTopic failed ${wsKey}:${topic} -> ${String(err?.message ?? err)}`);
      });
    }

    return () => this.unsubscribeTopic(topic, handler);
  }

  async unsubscribeTopic(topic: string, handler: Handler) {
    const set = this.listeners.get(topic);
    if (!set) return;
    set.delete(handler);

    if (set.size === 0) {
      this.listeners.delete(topic);
      const cat = this.category;
      await this.safeUnsubscribe([topic], cat, false);
    }
  }

  /** ------------------------ WS (private wallet) ------------------------ */

  /** Запустить внутреннюю подписку на баланс (один раз на процесс). */
  async ensureWalletFeed(opts?: { wsCategory?: 'unified' | 'linear' | 'inverse' | 'spot' }) {
    if (this.walletFeedStarted) return;
    this.walletFeedStarted = true;

    // Если хочешь «снапшот раз в N секунд» — оставь. Иначе лучше событиям WS верить.
    // Ниже — твой же REST-луп (оставил, но имей в виду rate limits).
    setInterval(async () => {
      try {
        const { byCoin } = await this.getBalanceREST({ accountType: 'UNIFIED' });
        this.wallet$.next({ ts: Date.now(), byCoin });
      } catch (e) {
        Logger.warn(`[WALLET] REST poll failed: ${String(e)}`);
      }
    }, 2000);

    // приватный wallet
    const topic = 'wallet';
    const cat = (opts?.wsCategory ?? 'unified') as any;
    const wsKey = this.wsKeyFor(cat, true);
    const wsSet = this.ensureWsSet(wsKey);

    if (!wsSet.has(topic)) {
      void this.safeSubscribe([topic], cat, true).catch(err => {
        Logger.error(`[WALLET] subscribe failed ${wsKey}:${topic} -> ${String(err?.message ?? err)}`);
      });
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

  private ingestWalletUpdate(update: any) {
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

  /** ------------------------ Open orders / positions ------------------------ */

  async getOpenOrders(category: CategoryV5 = 'linear', symbol?: string) {
    try {
      const params: any = { category, openOnly: 1 };
      if (symbol) params.symbol = symbol;
      // если у тебя только USDT-перпы — оставь. Иначе дерни отдельно USDC.
      const res = await this.rest.getActiveOrders({ ...params, settleCoin: 'USDT' });
      Logger.debug('Bybit getOpenOrders result', res);
      return res;
    } catch (err) {
      Logger.error('Failed to fetch open orders', err);
      throw err;
    }
  }

  async getOpenPositions(category: CategoryV5 = 'linear', symbol?: string) {
    try {
      const params: any = { category };
      if (symbol) params.symbol = symbol;
      // для linear Bybit требует либо symbol, либо settleCoin → подставим USDT
      const res = await this.rest.getPositionInfo({ ...params, settleCoin: 'USDT' });
      Logger.debug('Bybit getOpenPositions result', res);
      return res;
    } catch (err) {
      Logger.error('Failed to fetch positions', err);
      throw err;
    }
  }
}
