import { io } from 'socket.io-client';
export const socket = io('/', { transports: ['websocket'] });

export type StreamEvent =
  | { type: 'ticker'; payload: any }
  | { type: 'orderbook'; payload: any }
  | { type: 'trade'; payload: any }
  | { type: 'kline'; payload: any };
  