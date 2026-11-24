import Link from 'next/link';

export function PageHead({ title, intro, area, children }: { title: string; intro?: string; area?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {area && <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{area}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-sm text-zinc-600">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, note, children, className = '' }: { title?: string; note?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white p-4 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <span className="text-xs text-zinc-500">{note}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'bad' | 'good' | 'warn' }) {
  const c = tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-600' : 'text-zinc-900';
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export function Bars({ rows, format, max, color = 'bg-emerald-600', second }: { rows: { label: string; value: number; value2?: number }[]; format: (n: number) => string; max?: number; color?: string; second?: string }) {
  const m = max ?? Math.max(...rows.map((r) => Math.max(r.value, r.value2 ?? 0)), 1e-9);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9.5rem_1fr_6.5rem] items-center gap-3 text-sm">
          <span className="truncate text-zinc-700">{r.label}</span>
          <div className="space-y-0.5">
            <div className="h-2.5 rounded-sm bg-zinc-100"><div className={`h-2.5 rounded-sm ${color}`} style={{ width: `${(r.value / m) * 100}%` }} /></div>
            {r.value2 != null && <div className="h-2.5 rounded-sm bg-zinc-100"><div className={`h-2.5 rounded-sm ${second ?? 'bg-red-500'}`} style={{ width: `${(r.value2 / m) * 100}%` }} /></div>}
          </div>
          <span className="text-right tabular-nums text-zinc-700">{format(r.value2 ?? r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Table({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align?: ('l' | 'r')[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
            {head.map((h, i) => <th key={h} className={`px-2 py-2 font-medium ${align?.[i] === 'r' ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100 last:border-0">
              {r.map((c, j) => <td key={j} className={`px-2 py-2 ${align?.[j] === 'r' ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, tone = 'zinc' }: { children: React.ReactNode; tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue' }) {
  const t = { zinc: 'bg-zinc-100 text-zinc-700', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200' }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-transparent ${t}`}>{children}</span>;
}

export function Illustrative({ children }: { children?: React.ReactNode }) {
  return <p className="mt-3 text-xs text-zinc-500">⚠︎ {children ?? 'Illustrative parameters pending methodology sign-off. Synthetic loan book, no real customer data.'}</p>;
}

export function Btn({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <Link href={href} className={`rounded-md px-3 py-1.5 text-sm ${primary ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100'}`}>{children}</Link>;
}

export const btnClass = 'rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50';
export const btnGhost = 'rounded-md px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100';
