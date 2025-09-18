import React, { useEffect, useRef } from 'react';
import { createChart, IPriceLine, ISeriesApi, PriceLineSource, Time } from 'lightweight-charts';
import { Kline } from 'src/lib/api';

type Candle = { time: number; open: number; high: number; low: number; close: number };

type Props = { symbol: string; candles: Candle[], position: any, large?: boolean; onLoadMore: (symbol: string, val: number) => Promise<Kline[]> };

export default function CandleChart({ symbol, position, large, candles, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart>>();
  const seriesRef = useRef<ISeriesApi<'Candlestick'>>();
  const stopLossRef = useRef<IPriceLine>();

  // создаём чарт один раз на символ
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { timeScale: { tickMarkFormatter: val => { return new Date(val * 1000).getDate() !== new Date().getDate() ? `${new Date(val * 1000).toLocaleDateString().substring(0, 5)} ${new Date(val * 1000).toLocaleTimeString().substring(0, 5)}` : `${new Date(val * 1000).toLocaleTimeString().substring(0, 5)}` } }, height: document.body.clientHeight / (large ? 1.3 : 2.9), width: document.body.clientWidth / (large ? 1.1 : 2.2) });
    const series = chart.addCandlestickSeries({
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    });
    if (position) {
      series.createPriceLine({
        price: Number(position.avgPrice),
        color: '#000', // зелёная линия
        lineWidth: 1,
        lineStyle: 0, // 0 = solid, 1 = dotted, 2 = dashed
        axisLabelVisible: true, // показывать подпись на оси
        title: 'Buy', // подпись возле линии
      });
    }

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

  useEffect(() => {
    if (stopLossRef.current) {
      seriesRef.current?.removePriceLine(stopLossRef.current);
    }

    if (position?.stopLoss) {
      stopLossRef.current = seriesRef.current!.createPriceLine({
        price: Number(position.stopLoss),
        color: '#a00', // зелёная линия
        lineWidth: 1,
        lineStyle: 1, // 0 = solid, 1 = dotted, 2 = dashed
        axisLabelVisible: true, // показывать подпись на оси
        title: 'SL', // подпись возле линии
      });
    }
  }, [position]);

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
