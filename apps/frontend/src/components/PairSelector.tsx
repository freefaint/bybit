import React, { useEffect, useState } from 'react';
import { getSymbols } from '../lib/api';

type Props = { value: string[]; onChange: (pairs: string[]) => void };

export default function PairSelector({ value, onChange }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getSymbols().then(setOptions).catch(console.error);
  }, []);

  const filtered = options.filter(s => s.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по парам…"
        style={{ flex: 1, padding: 8 }}
      />
      <select
        multiple
        size={10}
        value={value}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map(o => o.value);
          onChange(selected);
        }}
        style={{ minWidth: 240, height: 240 }}
      >
        {filtered.map(sym => (
          <option key={sym} value={sym}>{sym}</option>
        ))}
      </select>
    </div>
  );
}