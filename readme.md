Monorepo: Bybit фронт + бэк (Vite React TS + NestJS TS)


Что внутри

bybit-monorepo/
├─ package.json                # workspaces + общие скрипты
├─ tsconfig.base.json
├─ .gitignore
├─ .env.example                # образец переменных окружения для бэка
├─ README.md
├─ apps/
│  ├─ backend/                 # NestJS
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ tsconfig.build.json
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ markets/
│  │  │  │  ├─ markets.module.ts
│  │  │  │  ├─ markets.controller.ts     # REST: инфо по инструментам, стакан и т.п.
│  │  │  │  ├─ markets.gateway.ts        # Socket.IO прокси для подписок
│  │  │  │  ├─ bybit.service.ts          # Клиент к Bybit (REST + WS v5)
│  │  │  │  ├─ types.ts
│  │  │  ├─ common/config.service.ts
│  │  │  ├─ common/logger.ts
│  │  ├─ .env.example
│  │  ├─ nest-cli.json
│  │  └─ README.md
│  └─ frontend/                # Vite React TS
│     ├─ package.json
│     ├─ index.html
│     ├─ tsconfig.json
│     ├─ vite.config.ts
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ components/
│        │  ├─ PairSelector.tsx
│        │  ├─ OrderBook.tsx
│        │  └─ CandleChart.tsx
│        ├─ lib/api.ts
│        └─ lib/socket.ts
└─ packages/
   └─ shared/
      ├─ package.json
      └─ src/index.ts          # Общие типы (DTO) фронт↔бэк


## Быстрый старт

### 1) Установи зависимости
```bash
npm i
npm -w apps/backend i
npm -w apps/frontend i
npm -w packages/shared i

2) Заполни переменные окружения для бэка

Скопируй apps/backend/.env.example в apps/backend/.env и пропиши ключи (если нужны приватные эндпоинты). Для публичных стримов можно без ключей.

3) Запуск разработки

npm run dev

Фронт: http://localhost:80
Бэк:   http://localhost:3000

4) Что уже работает
	•	REST: GET /api/orderbook?symbol=BTCUSDT&depth=50
	•	WS (Socket.IO): subscribe { symbols: [“BTCUSDT”], streams: [“orderbook”,“kline_1m”] }
	•	Фронт: ввод символов, подписка на стримы, отрисовка стакана и кэндлов (минимально, дальше наращиваем)

Почему проксируем сокеты через бэк
	•	Безопасность: ключам в браузере не место.
	•	Мультиплексирование: один коннект к Bybit, десятки клиентов через твой сокет.
	•	Троттлинг и кэш: централизованный контроль, перезаподписка при ребалансе.
	•	CORS и политика доступа: меньше сюрпризов.
	•	Расширяемость: легко добавить агрегаты, алерты, хранилище.

Дальше по плану (TODO)
	•	Хранить локальный snapshot стакана и применять дельты (depth=50/200) с проверкой u, pu версий — чтобы не мигали пересортировки.
	•	Исторические свечи по REST (инициализация чарта).
	•	Аутентификация на твоём сокете, квоты, комнаты на символ.
	•	Переключение категорий (spot/linear) в UI.
	•	Docker Compose (если надо — добавлю).













Monorepo: Bybit фронт + бэк (Vite React TS + NestJS TS)

Коротко: да, сокет лучше прокидывать через свой бэк. Безопасность ключей, единая аутентификация, троттлинг, кэш, мультиплексирование. Напрямую из браузера можно только паблик-потоки без ключей — и то иногда упрёшься в CORS/политику. Поэтому ниже — свой Socket.IO шлюз.

Что внутри

bybit-monorepo/
├─ package.json                # workspaces + общие скрипты
├─ tsconfig.base.json
├─ .gitignore
├─ .env.example                # образец переменных окружения для бэка
├─ README.md
├─ apps/
│  ├─ backend/                 # NestJS
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ tsconfig.build.json
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ markets/
│  │  │  │  ├─ markets.module.ts
│  │  │  │  ├─ markets.controller.ts     # REST: инфо по инструментам, стакан и т.п.
│  │  │  │  ├─ markets.gateway.ts        # Socket.IO прокси для подписок
│  │  │  │  ├─ bybit.service.ts          # Клиент к Bybit (REST + WS v5)
│  │  │  │  ├─ types.ts
│  │  │  ├─ common/config.service.ts
│  │  │  ├─ common/logger.ts
│  │  ├─ .env.example
│  │  ├─ nest-cli.json
│  │  └─ README.md
│  └─ frontend/                # Vite React TS
│     ├─ package.json
│     ├─ index.html
│     ├─ tsconfig.json
│     ├─ vite.config.ts
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ components/
│        │  ├─ PairSelector.tsx
│        │  ├─ OrderBook.tsx
│        │  └─ CandleChart.tsx
│        ├─ lib/api.ts
│        └─ lib/socket.ts
└─ packages/
   └─ shared/
      ├─ package.json
      └─ src/index.ts          # Общие типы (DTO) фронт↔бэк


⸻

package.json (корень)

{
  "name": "bybit-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently -n BACK,FRONT -c blue,green \"npm -w apps/backend run start:dev\" \"npm -w apps/frontend run dev\"",
    "build": "npm -w apps/backend run build && npm -w apps/frontend run build",
    "lint": "eslint ."
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "eslint": "^9.7.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.2"
  }
}

tsconfig.base.json

{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["packages/shared/src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}

.env.example (корень — просто памятка)

# Бэк читает свой .env в apps/backend/.env
# FRONTEND_BASE_URL=http://localhost:80
# BACKEND_BASE_URL=http://localhost:3000


⸻

Backend (NestJS)

apps/backend/package.json

{
  "name": "backend",
  "version": "1.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "socket.io": "^4.7.5",
    "axios": "^1.7.4",
    "dotenv": "^16.4.5",
    "rxjs": "^7.8.1",
    "bybit-api": "^4.2.7"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.4",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^22.5.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}
```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "socket.io": "^4.7.5",
    "axios": "^1.7.4",
    "ws": "^8.17.1",
    "dotenv": "^16.4.5",
    "rxjs": "^7.8.1",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.4",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^22.5.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}

apps/backend/nest-cli.json

{ "collection": "@nestjs/schematics", "sourceRoot": "src" }

apps/backend/tsconfig.json

{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

apps/backend/tsconfig.build.json

{
  "extends": "./tsconfig.json",
  "compilerOptions": { "declaration": true, "sourceMap": true },
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}

apps/backend/.env.example

# Bybit окружение
BYBIT_API_KEY=
BYBIT_API_SECRET=
BYBIT_USE_TESTNET=true

# Категория рынков: spot | linear | inverse | option
BYBIT_CATEGORY=spot

# HTTP порт бэкенда
PORT=3000
# CORS — откуда пускать фронт
CORS_ORIGIN=http://localhost:80

apps/backend/src/common/logger.ts

import { Logger as NestLogger } from '@nestjs/common';
export const Logger = new NestLogger('APP');

apps/backend/src/common/config.service.ts

import * as dotenv from 'dotenv';

dotenv.config({ path: process.env.CONFIG_PATH || undefined });

export class ConfigService {
  readonly port = Number(process.env.PORT || 3000);
  readonly corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:80';

  readonly bybitApiKey = process.env.BYBIT_API_KEY || '';
  readonly bybitApiSecret = process.env.BYBIT_API_SECRET || '';
  readonly bybitUseTestnet = (process.env.BYBIT_USE_TESTNET || 'true') === 'true';
  readonly bybitCategory = (process.env.BYBIT_CATEGORY || 'spot') as
    | 'spot'
    | 'linear'
    | 'inverse'
    | 'option';

  get httpBase() {
    return this.bybitUseTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  }
  get wsPublicBase() {
    // v5 public WS
    return this.bybitUseTestnet
      ? 'wss://stream-testnet.bybit.com/v5/public'
      : 'wss://stream.bybit.com/v5/public';
  }
  get wsPrivateBase() {
    return this.bybitUseTestnet
      ? 'wss://stream-testnet.bybit.com/v5/private'
      : 'wss://stream.bybit.com/v5/private';
  }
}

export const config = new ConfigService();

apps/backend/src/app.module.ts

import { Module } from '@nestjs/common';
import { MarketsModule } from './markets/markets.module';

@Module({ imports: [MarketsModule] })
export class AppModule {}

apps/backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './common/config.service';
import { Logger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: config.corsOrigin } });
  await app.listen(config.port);
  Logger.log(`HTTP on http://localhost:${config.port}`);
}
bootstrap();

apps/backend/src/markets/types.ts

export type SymbolName = string; // например 'BTCUSDT'

export interface SubscribePayload {
  symbols: SymbolName[]; // ['BTCUSDT','ETHUSDT']
  streams?: Array<'ticker' | 'orderbook' | 'trade' | 'kline_1m'>;
}

export interface OrderBookItem { price: number; size: number }
export interface OrderBookSnapshot { symbol: string; bids: OrderBookItem[]; asks: OrderBookItem[]; ts: number }

export interface TickerPayload { symbol: string; lastPrice: number; price24hPcnt: number; ts: number }
export interface TradePayload { symbol: string; price: number; qty: number; side: 'Buy' | 'Sell'; ts: number }
export interface KlinePayload { symbol: string; open: number; high: number; low: number; close: number; volume: number; start: number; end: number }

apps/backend/src/markets/bybit.service.ts

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { config } from '../common/config.service';
import { Logger } from '../common/logger';
import { RestClientV5, WebsocketClient, WSClientConfigurableTopics } from 'bybit-api';

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
    const res = await this.rest.getOrderBook({ category: config.bybitCategory, symbol, limit: depth as 50 | 200 });
    const bids = (res.result?.b || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    const asks = (res.result?.a || []).map((i) => ({ price: Number(i[0]), size: Number(i[1]) }));
    return { symbol, bids, asks, ts: Date.now() };
  }

  /** Подписка на WS V5 с категорией */
  subscribeTopic(topic: string, handler: (msg: any) => void) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(handler);

    const category = (config.bybitCategory || 'spot') as WSClientConfigurableTopics['v5'];
    this.ws.subscribeV5([topic], category);

    return () => this.unsubscribeTopic(topic, handler);
  }

  unsubscribeTopic(topic: string, handler: (msg: any) => void) {
    const set = this.listeners.get(topic);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(topic);
        const category = (config.bybitCategory || 'spot') as WSClientConfigurableTopics['v5'];
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
```ts
import axios from 'axios';
import WebSocket from 'ws';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { config } from '../common/config.service';
import { Logger } from '../common/logger';
import { OrderBookSnapshot } from './types';

/**
 * Минималистичный клиент к Bybit v5: REST для стакана, WS для стримов.
 * Без официального SDK, чтобы избежать несовместимостей — чистый HTTP/WS.
 */
@Injectable()
export class BybitService implements OnModuleDestroy {
  private ws?: WebSocket; // один WS на категорию, мультиплексируем темы
  private wsConnected = false;
  private pendingSubs = new Set<string>();
  private listeners = new Map<string, Set<(msg: any) => void>>(); // topic -> handlers

  private get wsUrl() {
    // public WS v5: .../v5/public/{category}
    return `${config.wsPublicBase}/${config.bybitCategory}`;
  }

  onModuleDestroy() {
    this.ws?.close();
  }

  /** REST: стакан */
  async fetchOrderBook(symbol: string, depth = 50): Promise<OrderBookSnapshot> {
    const url = `${config.httpBase}/v5/market/orderbook?category=${config.bybitCategory}&symbol=${symbol}&limit=${depth}`;
    const { data } = await axios.get(url);
    if (data.retCode !== 0) throw new Error(`Bybit error: ${data.retMsg}`);
    const bids = (data.result.b || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
    const asks = (data.result.a || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
    return { symbol, bids, asks, ts: Date.now() };
  }

  /** Подписка на тему WS */
  private ensureWs() {
    if (this.ws && this.wsConnected) return;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.wsConnected = true;
      Logger.log(`[WS] connected to ${this.wsUrl}`);
      if (this.pendingSubs.size) {
        const args = Array.from(this.pendingSubs);
        this.ws!.send(JSON.stringify({ op: 'subscribe', args }));
        Logger.log(`[WS] resubscribe ${args.length} topics`);
      }
    });

    this.ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        // сообщения бывают пинг-понг, snapshot/update, т.д.
        if (msg.op === 'pong') return;
        if (msg.topic) this.dispatch(msg.topic, msg);
      } catch (e) {
        Logger.error(`[WS] parse error ${e}`);
      }
    });

    this.ws.on('close', () => {
      this.wsConnected = false;
      Logger.warn('[WS] closed, retrying in 2s');
      setTimeout(() => this.ensureWs(), 2000);
    });

    this.ws.on('error', (err) => {
      Logger.error(`[WS] error ${err}`);
    });
  }

  private dispatch(topic: string, msg: any) {
    const set = this.listeners.get(topic);
    if (!set) return;
    for (const fn of set) fn(msg);
  }

  subscribeTopic(topic: string, handler: (msg: any) => void) {
    this.ensureWs();
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(handler);

    this.pendingSubs.add(topic);
    if (this.wsConnected) this.ws!.send(JSON.stringify({ op: 'subscribe', args: [topic] }));

    return () => this.unsubscribeTopic(topic, handler);
  }

  unsubscribeTopic(topic: string, handler: (msg: any) => void) {
    const set = this.listeners.get(topic);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(topic);
        this.pendingSubs.delete(topic);
        if (this.wsConnected) this.ws!.send(JSON.stringify({ op: 'unsubscribe', args: [topic] }));
      }
    }
  }

  // Хелперы для тем v5
  topicTicker(symbol: string) {
    return `tickers.${symbol}`;
  }
  topicOrderbook(symbol: string, depth: 50 | 200 = 50) {
    return `orderbook.${depth}.${symbol}`;
  }
  topicTrades(symbol: string) {
    return `publicTrade.${symbol}`;
  }
  topicKline(symbol: string, interval: '1' | '3' | '5' | '15' | '30' | '60') {
    return `kline.${interval}.${symbol}`; // 1=1m, 60=1h
  }
}

apps/backend/src/markets/markets.module.ts

import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { BybitService } from './bybit.service';

@Module({
  controllers: [MarketsController],
  providers: [BybitService, MarketsGateway],
  exports: [BybitService]
})
export class MarketsModule {}

apps/backend/src/markets/markets.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { BybitService } from './bybit.service';

@Controller('api')
export class MarketsController {
  constructor(private readonly bybit: BybitService) {}

  // Простой REST: стакан по символу
  @Get('orderbook')
  async orderbook(@Query('symbol') symbol: string, @Query('depth') depth = '50') {
    const d = Number(depth) as 50 | 200;
    return this.bybit.fetchOrderBook(symbol, d);
  }

  // Пинг (жив ли бэк)
  @Get('ping')
  ping() {
    return { ok: true, ts: Date.now() };
  }
}

apps/backend/src/markets/markets.gateway.ts

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
```ts
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


⸻

Frontend (Vite React TS)

apps/frontend/package.json

{
  "name": "frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 80"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.7.5",
    "axios": "^1.7.4",
    "lightweight-charts": "^4.2.2"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vite": "^5.4.6",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0"
  }
}

apps/frontend/tsconfig.json

{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021", "DOM"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["../../packages/shared/src/*"] },
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "references": []
}

apps/frontend/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 80, proxy: { '/api': 'http://localhost:3000' } }
});

apps/frontend/index.html

<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bybit Monitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

apps/frontend/src/lib/api.ts

import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

export async function getOrderBook(symbol: string, depth = 50) {
  const { data } = await api.get('/orderbook', { params: { symbol, depth } });
  return data as { symbol: string; bids: [number, number][]; asks: [number, number][] };
}

apps/frontend/src/lib/socket.ts

import { io } from 'socket.io-client';
export const socket = io('http://localhost:3000', { transports: ['websocket'] });

export type StreamEvent =
  | { type: 'ticker'; payload: any }
  | { type: 'orderbook'; payload: any }
  | { type: 'trade'; payload: any }
  | { type: 'kline'; payload: any };

apps/frontend/src/main.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);

apps/frontend/src/components/PairSelector.tsx

import React, { useState } from 'react';

type Props = { onApply: (pairs: string[]) => void };

export default function PairSelector({ onApply }: Props) {
  const [text, setText] = useState('BTCUSDT,ETHUSDT');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const pairs = text.split(',').map((s) => s.trim()).filter(Boolean);
        onApply(pairs);
      }}
      style={{ display: 'flex', gap: 8, marginBottom: 12 }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Символы через запятую"
        style={{ flex: 1, padding: 8 }}
      />
      <button type="submit">Подписаться</button>
    </form>
  );
}

apps/frontend/src/components/OrderBook.tsx

import React from 'react';

type Row = { price: number; size: number };

type Props = { symbol: string; bids: Row[]; asks: Row[] };

export default function OrderBook({ symbol, bids, asks }: Props) {
  const maxSize = Math.max(...bids.map(b=>b.size), ...asks.map(a=>a.size), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <h3>{symbol} — Bids</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {bids.slice(0, 20).map((b, i) => (
            <React.Fragment key={i}>
              <div style={{ background: `rgba(0, 200, 0, ${b.size / maxSize})` }}>{b.price.toFixed(4)}</div>
              <div>{b.size}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div>
        <h3>{symbol} — Asks</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {asks.slice(0, 20).map((a, i) => (
            <React.Fragment key={i}>
              <div style={{ background: `rgba(200, 0, 0, ${a.size / maxSize})` }}>{a.price.toFixed(4)}</div>
              <div>{a.size}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

apps/frontend/src/components/CandleChart.tsx

import React, { useEffect, useRef } from 'react';
import { createChart, ISeriesApi } from 'lightweight-charts';

type Candle = { time: number; open: number; high: number; low: number; close: number };

type Props = { symbol: string; candles: Candle[] };

export default function CandleChart({ symbol, candles }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'>>();

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { height: 300 });
    const series = chart.addCandlestickSeries();
    seriesRef.current = series;
    return () => chart.remove();
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(candles.map(c => ({ time: c.time / 1000, open: c.open, high: c.high, low: c.low, close: c.close })));
  }, [candles]);

  return (
    <div>
      <h3>{symbol} — Кэндлы</h3>
      <div ref={ref} />
    </div>
  );
}

apps/frontend/src/App.tsx

import React, { useEffect, useMemo, useState } from 'react';
import PairSelector from './components/PairSelector';
import OrderBook from './components/OrderBook';
import CandleChart from './components/CandleChart';
import { socket } from './lib/socket';
import { getOrderBook } from './lib/api';

type OBRow = { price: number; size: number };

type OBMap = Record<string, { bids: OBRow[]; asks: OBRow[] }>;

type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function App() {
  const [pairs, setPairs] = useState<string[]>(['BTCUSDT']);
  const [orderbooks, setOrderbooks] = useState<OBMap>({});
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});

  useEffect(() => {
    socket.on('orderbook', ({ symbol, data }) => {
      const bids = (data.b || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
      const asks = (data.a || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
      setOrderbooks((prev) => ({ ...prev, [symbol]: { bids, asks } }));
    });
    socket.on('kline', ({ symbol, data }) => {
      // data[0] для kline может быть массивом — упрощаем пример
      const arr = Array.isArray(data) ? data : [data];
      setCandles((p) => ({
        ...p,
        [symbol]: arr.map((k: any) => ({
          time: Number(k.start || k.startTime || Date.now()),
          open: Number(k.open), high: Number(k.high), low: Number(k.low), close: Number(k.close)
        }))
      }));
    });
    return () => {
      socket.off('orderbook');
      socket.off('kline');
    };
  }, []);

  const widgets = useMemo(() => pairs.map((s) => (
    <div key={s} style={{ border: '1px solid #444', padding: 12, borderRadius: 8, marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>{s}</h2>
      <OrderBook symbol={s} bids={orderbooks[s]?.bids || []} asks={orderbooks[s]?.asks || []} />
      <CandleChart symbol={s} candles={candles[s] || []} />
    </div>
  )), [pairs, orderbooks, candles]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1>Bybit Monitor</h1>
      <PairSelector onApply={(symbols) => {
        setPairs(symbols);
        socket.emit('subscribe', { symbols, streams: ['orderbook', 'kline_1m'] });
        // также можно бахнуть первичный REST-запрос для быстрой инициализации
        symbols.forEach(async (sym) => {
          try {
            const ob = await getOrderBook(sym, 50);
            // типизация упрощена — приводим в локальный формат
            const bids = (ob.bids as any).map((i: any) => ({ price: Number(i[0] ?? i.price), size: Number(i[1] ?? i.size) }));
            const asks = (ob.asks as any).map((i: any) => ({ price: Number(i[0] ?? i.price), size: Number(i[1] ?? i.size) }));
            setOrderbooks((p) => ({ ...p, [sym]: { bids, asks } }));
          } catch (e) { console.error(e); }
        });
      }} />
      {widgets}
    </div>
  );
}


⸻

packages/shared

packages/shared/package.json

{ "name": "@shared", "version": "1.0.0", "private": true, "main": "src/index.ts", "types": "src/index.ts" }

packages/shared/src/index.ts

export type SubscribeRequest = { symbols: string[]; streams?: string[] };


⸻

README.md (корень)

## Быстрый старт

### 1) Установи зависимости
```bash
npm i
npm -w apps/backend i
npm -w apps/frontend i
npm -w packages/shared i

2) Заполни переменные окружения для бэка

Скопируй apps/backend/.env.example в apps/backend/.env и пропиши ключи (если нужны приватные эндпоинты). Для публичных стримов можно без ключей.

3) Запуск разработки

npm run dev

Фронт: http://localhost:8080
Бэк:   http://localhost:3000

4) Что уже работает
	•	REST: GET /api/orderbook?symbol=BTCUSDT&depth=50
	•	WS (Socket.IO): subscribe { symbols: [“BTCUSDT”], streams: [“orderbook”,“kline_1m”] }
	•	Фронт: ввод символов, подписка на стримы, отрисовка стакана и кэндлов (минимально, дальше наращиваем)

Почему проксируем сокеты через бэк
	•	Безопасность: ключам в браузере не место.
	•	Мультиплексирование: один коннект к Bybit, десятки клиентов через твой сокет.
	•	Троттлинг и кэш: централизованный контроль, перезаподписка при ребалансе.
	•	CORS и политика доступа: меньше сюрпризов.
	•	Расширяемость: легко добавить агрегаты, алерты, хранилище.

Дальше по плану (TODO)
	•	Хранить локальный snapshot стакана и применять дельты (depth=50/200) с проверкой u, pu версий — чтобы не мигали пересортировки.
	•	Исторические свечи по REST (инициализация чарта).
	•	Аутентификация на твоём сокете, квоты, комнаты на символ.
	•	Переключение категорий (spot/linear) в UI.
	•	Docker Compose (если надо — добавлю).

