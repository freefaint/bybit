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
              <div style={{ background: `rgba(0, 200, 0, ${b.size / maxSize})` }}>{b.price.toFixed(5)}</div>
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
              <div style={{ background: `rgba(200, 0, 0, ${a.size / maxSize})` }}>{a.price.toFixed(5)}</div>
              <div>{a.size}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
