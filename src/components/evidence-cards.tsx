'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface EvidenceItem {
  id: string;
  label: string;
  value: string;
  sub?: string;
  evidence: ReactNode;
}

export function EvidenceCards({ items, label, columns = 4 }: { items: EvidenceItem[]; label: string; columns?: 3 | 4 }) {
  const [selected, setSelected] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useId();
  const item = items.find(({ id }) => selected === id);
  useEffect(() => {
    if (selected) heading.current?.focus();
  }, [selected]);

  return <section aria-label={label}>
    <div className={`grid gap-3 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {items.map(({ id, label, value, sub }) => <button key={id} type="button" aria-expanded={id === selected} aria-controls={panel}
        onClick={() => setSelected(id === selected ? undefined : id)}
        className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 text-left hover:border-lime-600 hover:bg-lime-50 focus-visible:outline-2 focus-visible:outline-lime-700 aria-expanded:border-lime-600 aria-expanded:bg-lime-50">
        <span className="block text-sm text-zinc-700">{label}</span>
        <span className="mt-1 block break-words text-xl font-semibold tabular-nums">{value}</span>
        {sub && <span className="mt-1 block break-words text-sm text-zinc-600">{sub}</span>}
        <span className="mt-2 block text-sm font-medium text-emerald-800 underline">{id === selected ? 'Hide evidence' : 'View evidence'}</span>
      </button>)}
    </div>
    <div id={panel} hidden={!item} className="mt-4 rounded-lg border border-lime-400 bg-lime-50 p-4">
      {item && <>
        <h2 ref={heading} tabIndex={-1} className="scroll-mt-5 text-base font-semibold">{item.label} evidence</h2>
        <div className="mt-3 space-y-3 text-sm">{item.evidence}</div>
      </>}
    </div>
  </section>;
}
