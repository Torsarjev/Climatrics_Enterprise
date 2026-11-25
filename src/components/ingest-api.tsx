'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnClass } from './ui';

interface Loaded { id: string; sha256: string; sourceChecksumMatched?: boolean; control: { rowsRead: number; rowsAccepted: number; rowsRejected: number; reconciled: boolean } }

export function IngestApi({ canIngest }: { canIngest: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ pending?: boolean; ok?: Loaded; error?: string }>({});
  const pull = async () => {
    setState({ pending: true });
    try {
      const csv = await (await fetch('/api/sample')).text();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(csv)))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = await fetch('/api/datasets', { method: 'POST', headers: { 'Content-Type': 'text/csv', 'X-Source-System': 'Core banking (simulated)', 'X-Source-SHA256': digest }, body: csv });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState({ ok: body });
      router.refresh();
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };
  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">{`POST /api/datasets
Content-Type: text/csv
X-Source-System: <core banking system>
X-Source-SHA256: <optional upstream checksum>

<loan book extract, same columns as the CSV>`}</pre>
      <p className="text-xs text-zinc-600">Returns <span className="font-mono">201</span> with the dataset ID, SHA-256, control totals and rejected rows. The same validation rules, reconciliation, checksum verification and versioning apply as for a file upload. <span className="font-mono">GET /api/datasets</span> lists every version.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnClass} disabled={state.pending || !canIngest} onClick={pull} data-action="api-pull">{state.pending ? 'Calling the API…' : 'Pull from core banking API (simulated)'}</button>
        {!canIngest && <span className="text-xs text-amber-700">Your role cannot load data</span>}
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700" data-api-result>201 Created · {state.ok.id} · {state.ok.control.rowsAccepted} accepted, {state.ok.control.rowsRejected} rejected · {state.ok.control.reconciled ? 'reconciled ✓' : 'reconciliation break ✕'}{state.ok.sourceChecksumMatched ? ' · source checksum matched ✓' : ''}</p>}
    </div>
  );
}
