import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

export async function getOrderBook(symbol: string, depth = 50) {
  const { data } = await api.get('/orderbook', { params: { symbol, depth } });
  return data as { symbol: string; bids: [number, number][]; asks: [number, number][] };
}

export type Kline = { time: number; open: number; high: number; low: number; close: number; volume: number };

export async function getKlines(
  symbol: string,
  interval: '1' | '3' | '5' | '15' | '30' | '60' | '240' | 'D' = '1',
  limit = 500,
  end?: number
): Promise<Kline[]> {
  const { data } = await api.get('/klines', { params: { symbol, interval, limit, end } });
  // сервер уже нормализовал, просто на всякий пожарный приводим ключи
  // Держим time в МС в состоянии
  return (data.list as any[]).map((k: any) => ({
    time: Number(k.time ?? k[0]),          // ms из бэка
    open: Number(k.open ?? k[1]),
    high: Number(k.high ?? k[2]),
    low:  Number(k.low  ?? k[3]),
    close:Number(k.close?? k[4]),
    volume:Number(k.volume?? k[5]),
  }));
}

export async function getSymbols(): Promise<string[]> {
  const { data } = await api.get('/symbols');
  return data.symbols as string[];
}