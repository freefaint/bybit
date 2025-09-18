import React, { useEffect, useRef } from 'react';
import { createChart, ISeriesApi, Time } from 'lightweight-charts';
import { Kline } from 'src/lib/api';

type Candle = { time: number; open: number; high: number; low: number; close: number };

type Props = { symbol: string; candles: Candle[], onLoadMore: (symbol: string, val: number) => Promise<Kline[]> };

export default function CandleChart({ symbol, candles, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart>>();
  const seriesRef = useRef<ISeriesApi<'Candlestick'>>();

  // создаём чарт один раз на символ
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { timeScale: { tickMarkFormatter: val => new Date(val).getDay() !== new Date().getDay() ? `${new Date(val).toLocaleDateString()} ${new Date(val).toLocaleTimeString()}` : `${new Date(val).toLocaleTimeString()}` }, height: document.body.clientHeight / 3, width: document.body.clientWidth / 2.2 });
    const series = chart.addCandlestickSeries({
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    // подписка на скролл влево
    chart.timeScale().subscribeVisibleTimeRangeChange(async (range) => {
      if (!range || !seriesRef.current || !onLoadMore) return;
      const bars = seriesRef.current.data() as any[]; // time в СЕКУНДАХ
      if (!bars?.length) return;

      const firstBar = bars[0]; // time в секундах
      if (range.from != null && range.from <= firstBar.time) {
        const olderMs = await onLoadMore(symbol, (firstBar.time as number) * 1000); // → ms
        if (olderMs?.length) {
          // конвертим в сек. и мержим слева. older уже отсортирован asc
          const olderSec = olderMs.map(b => ({
            time: b.time / 1000,
            open: b.open, high: b.high, low: b.low, close: b.close,
          }));
          seriesRef.current.setData([...olderSec, ...bars]); // теперь строго asc по time (сек)
        }
      }
    });

    return () => chart.remove();
  }, [symbol]);

  // обновление данных без пересоздания чарта
  useEffect(() => {
    if (!seriesRef.current) return;
    if (!candles?.length) return;
    // state хранит time в МС → чарту отдаём СЕКУНДЫ
    seriesRef.current.setData(
      candles.map(c => ({
        time: c.time / 1000 as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }))
    );
  }, [candles]);

  return <div ref={ref} />;
}
