'use client';

import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const bin = (xs: number[], max: number, bins: number) => {
  const out = new Array(bins).fill(0);
  xs.forEach((v) => { out[Math.min(bins - 1, Math.floor((v / max) * bins))]++; });
  return out.map((n) => +((n / xs.length) * 100).toFixed(2));
};

export function LossChart({ base, stressed, varBase, varStressed }: { base: number[]; stressed: number[]; varBase: number; varStressed: number }) {
  const max = Math.max(...base, ...stressed, varStressed * 1.08), bins = 45;
  const b = bin(base, max, bins), s = bin(stressed, max, bins);
  const data = b.map((n, i) => ({ x: Math.round(((i + 0.5) * max) / bins / 1e6), base: n, stressed: s[i] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 16, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid stroke="#f4f4f5" />
        <XAxis dataKey="x" type="number" domain={[0, 'dataMax']} tick={{ fontSize: 11 }} unit="m" />
        <YAxis tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v, n) => [`${v}% of scenarios`, n === 'base' ? 'Base' : 'Climate-stressed']} labelFormatter={(l) => `1-year loss ≈ GHS ${l}m`} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'base' ? 'Base' : 'Climate-stressed')} />
        <Area isAnimationActive={false} dataKey="base" type="step" stroke="#71717a" fill="#a1a1aa" fillOpacity={0.25} strokeWidth={2} />
        <Area isAnimationActive={false} dataKey="stressed" type="step" stroke="#dc2626" fill="#fca5a5" fillOpacity={0.25} strokeWidth={2} />
        <ReferenceLine x={Math.round(varBase / 1e6)} stroke="#71717a" strokeDasharray="4 3" label={{ value: 'VaR 99.9 base', fontSize: 10, position: 'insideTopRight' }} />
        <ReferenceLine x={Math.round(varStressed / 1e6)} stroke="#dc2626" strokeDasharray="4 3" label={{ value: 'VaR 99.9 stressed', fontSize: 10, position: 'insideTopLeft' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
