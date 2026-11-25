'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function CalibrationChart({ years, ghana, ssa, unit, benchmark = 'Sub-Saharan Africa' }: { years: readonly number[]; ghana: readonly number[]; ssa: readonly number[]; unit: string; benchmark?: string }) {
  const data = years.map((y, i) => ({ year: y, Ghana: ghana[i], regional: ssa[i] }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} interval={3} />
          <YAxis tick={{ fontSize: 11 }} width={36} unit={unit} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}${unit}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="Ghana" stroke="#c2410c" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="regional" name={benchmark} stroke="#1b2c3e" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
