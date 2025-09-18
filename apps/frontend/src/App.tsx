import React, { useEffect, useMemo, useRef, useState } from 'react';
import PairSelector from './components/PairSelector';
import OrderBook from './components/OrderBook';
import CandleChart from './components/CandleChart';
import { socket } from './lib/socket';
import { getOrderBook, getKlines } from './lib/api';

type OBRow = { price: number; size: number };

type OBMap = Record<string, { bids: OBRow[]; asks: OBRow[] }>;

type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function App() {
  const [pairs, setPairs] = useState<string[]>(['TAUSDT', 'MYXUSDT', 'BTCUSDT', 'ETHUSDT']);
  const [orderbooks, setOrderbooks] = useState<OBMap>({});
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});

  useEffect(() => {
    socket.on('orderbook', ({ symbol, data }) => {
      const bids = (data.b || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
      const asks = (data.a || []).map((i: string[]) => ({ price: Number(i[0]), size: Number(i[1]) }));
      setOrderbooks((prev) => ({ ...prev, [symbol]: { bids, asks } }));
    });
    socket.on('kline', ({ symbol, data }) => {
      const arr = Array.isArray(data) ? data : [data];
      const newCandles = arr.map((k: any) => ({
        time: Number(k.start || k[0] || Date.now()),
        open: Number(k.open ?? k[1]),
        high: Number(k.high ?? k[2]),
        low: Number(k.low ?? k[3]),
        close: Number(k.close ?? k[4]),
        volume: Number(k.volume ?? k[5]),
      }));

      setCandles((prev) => {
        const prevList = prev[symbol] || [];
        // ищем свечи по времени (bybit start timestamp)
        const merged = [...prevList];
        newCandles.forEach((nc) => {
          const idx = merged.findIndex((c) => c.time === nc.time);
          if (idx >= 0) merged[idx] = nc; // обновляем существующую
          else merged.push(nc);           // или добавляем новую
        });
        return { ...prev, [symbol]: merged };
      });
    });
    return () => {
      socket.off('orderbook');
      socket.off('kline');
    };
  }, []);

  async function loadMore(symbol: string, fromTime: number) {
    // подгружаем ещё 500 свечей до fromTime
    const older = await getKlines(symbol, '1', 500, fromTime);
    return older;
  }

  const subscribeAndPrime = async (symbols: string[]) => {
    // живые потоки
    socket.emit('subscribe', { symbols, streams: ['orderbook', 'kline_1m'] });

    // первичная инициализация: стакан + исторические свечи
    for (const sym of symbols) {
      try {
        const ob = await getOrderBook(sym, 50);
        const bids = (ob.bids as any).map((i: any) => ({ price: Number(i[0] ?? i.price), size: Number(i[1] ?? i.size) }));
        const asks = (ob.asks as any).map((i: any) => ({ price: Number(i[0] ?? i.price), size: Number(i[1] ?? i.size) }));
        setOrderbooks((p) => ({ ...p, [sym]: { bids, asks } }));

        const kl = await getKlines(sym, '5', 500);
        setCandles((p) => ({ ...p, [sym]: kl }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => { subscribeAndPrime(pairs); }, []);

  const widgets = useMemo(() => pairs.map((s) => (
    <div key={s} style={{ padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>{s}</h2>
      {/* <OrderBook symbol={s} bids={orderbooks[s]?.bids || []} asks={orderbooks[s]?.asks || []} /> */}
      <CandleChart onLoadMore={loadMore} symbol={s} candles={candles[s] || []} />
    </div>
  )), [pairs, orderbooks, candles]);

  const [how, setHow] = useState(0)

  return (
    <div style={{ minHeight: '100vh', background: how > 0 ? "#cfc" : how < 0 ? "#fcc" : "#fff", margin: '0 auto', padding: 8 }}>
      <Balance onChange={setHow} />

      <div style={{ display: "flex", alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8,  }}>
        {/* <h1>Bybit Monitor</h1>
        <PairSelector
          value={pairs}
          onChange={(symbols) => {
            setPairs(symbols);
            subscribeAndPrime(symbols); // твоя функция подписки + первичной загрузки
          }}
        /> */}
        
        {widgets}
      </div>
    </div>
  );
}

export const Balance = ({ onChange }: { onChange: (val: number) => void }) => {
  const [result, setResult] = useState<any>({});
  const ref = useRef(0);

  useEffect(() => {
    socket.emit('wallet:subscribe');

    socket.on('wallet:update', (state) => {
      // state: { ts, byCoin: { USDT: { equity, availableBalance, ... }, ... } }
      setResult(state);
      onChange(state.byCoin.USDT?.equity - ref.current)
      ref.current = state.byCoin.USDT?.equity;
      console.log('wallet', state.byCoin.USDT?.equity);
    });

    return () => {
      socket.emit('wallet:unsubscribe');
    }
  }, []);
  return <div><h1 style={{ textAlign: "center", margin: 0 }}>{result?.byCoin?.USDT?.equity && Number(Math.ceil(result?.byCoin?.USDT?.equity * 100) / 100).toLocaleString('ru-RU')} USDT</h1></div>
}
