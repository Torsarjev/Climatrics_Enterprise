'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { btnClass } from './ui';

export function BorrowerSelector({ selected, options }: {
  selected: string;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form action="/physical#borrower-risk" method="get" className="mb-5 flex flex-wrap items-end gap-3" aria-busy={pending}>
      <label className="min-w-0 text-sm font-medium">
        Borrower or facility
        <select key={selected} name="borrower" defaultValue={selected} disabled={!options.length || pending}
          onChange={(event) => {
            const id = event.currentTarget.value;
            startTransition(() => router.push(`/physical?borrower=${encodeURIComponent(id)}#borrower-risk`, { scroll: false }));
          }}
          className="mt-1 block max-w-full rounded-md border border-lime-400 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-lime-700">
          {!selected && <option value="" disabled>Select a borrower</option>}
          {options.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button className={btnClass} disabled={!options.length || pending}>Open profile</button>
      <span role="status" className="text-sm text-lime-900">{pending ? 'Updating borrower scores…' : ''}</span>
    </form>
  );
}
