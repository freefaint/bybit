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