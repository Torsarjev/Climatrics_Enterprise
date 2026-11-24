'use client';

import { useActionState, useMemo, useState } from 'react';
import { screenRunAction } from '@/app/actions';
import { ACTIVITIES } from '@/lib/esg/rules';
import { evidenceLabel, neededEvidence, screen, visibleQuestions, type EvidenceStatus, type ScreenInput } from '@/lib/esg/engine';
import { btnClass } from './ui';

export interface FacilityOption { id: string; borrower: string; sector: string; sectorName: string; region: string; ead: number; preset: ScreenInput }

const m = (n: number) => `GHS ${(n / 1e6).toFixed(1)}m`;
const TONE = { red: 'bg-red-50 text-red-700 ring-red-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', green: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };

export function ScreenBuilder({ facilities, initialId, previous }: { facilities: FacilityOption[]; initialId?: string; previous?: { id: string; input: ScreenInput } }) {
  const [state, action, pending] = useActionState(screenRunAction, null);
  const initial = facilities.find((facility) => facility.id === initialId) ?? facilities[0];
  const [fid, setFid] = useState(initial.id);
  const [input, setInput] = useState<ScreenInput>(() => previous ? {
    ...initial.preset,
    activities: previous.input.activities,
    responses: previous.input.responses,
    evidence: Object.fromEntries(Object.entries(previous.input.evidence).map(([id, item]) => [id, { ...item, status: item.status === 'verified' ? 'provided' : item.status }])),
  } : initial.preset);
  const pick = (id: string) => { const f = facilities.find((x) => x.id === id)!; setFid(id); setInput(structuredClone(f.preset)); };
  const fac = facilities.find((x) => x.id === fid)!;

  const questions = useMemo(() => visibleQuestions(input), [input]);
  const evidenceIds = useMemo(() => neededEvidence(input), [input]);
  const preview = useMemo(() => screen(input), [input]);
  const allocated = input.activities.reduce((a, b) => a + b.amount, 0);

  const setAct = (i: number, patch: Partial<ScreenInput['activities'][number]>) => setInput((s) => ({ ...s, activities: s.activities.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const setResp = (q: string, v: boolean | null) => setInput((s) => ({ ...s, responses: { ...s.responses, [q]: v } }));
  const setEv = (e: string, patch: Partial<ScreenInput['evidence'][string]>) => setInput((s) => ({ ...s, evidence: { ...s.evidence, [e]: { ...(s.evidence[e] ?? { status: 'missing' as const }), ...patch } } }));
  const field = 'rounded-md bg-white px-2 py-1.5 text-sm ring-1 ring-zinc-300';

  return (
    <form action={action} className="space-y-6">
      {previous && fid === previous.input.facilityId && <>
        <input type="hidden" name="parent" value={previous.id} />
        <p className="text-sm text-zinc-600">Re-screening assessment {previous.id}. Evidence must be verified for the new assessment.</p>
      </>}
      <input type="hidden" name="payload" value={JSON.stringify(input)} />
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="text-xs text-zinc-600">Facility (from the active portfolio)
          <select value={fid} onChange={(e) => pick(e.target.value)} className={`mt-1 w-full ${field}`}>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.borrower} · {m(f.ead)}</option>)}
          </select>
        </label>
        <div className="text-xs text-zinc-600">Sector<p className="mt-2 text-sm text-zinc-900">{fac.sectorName}</p></div>
        <div className="text-xs text-zinc-600">Region<p className="mt-2 text-sm text-zinc-900">{fac.region}</p></div>
        <div className="text-xs text-zinc-600">Outstanding<p className="mt-2 text-sm font-semibold text-zinc-900">{m(fac.ead)}</p></div>
      </div>

      <section>
        <p className="text-sm font-semibold">1 · Financed activities (use of proceeds)</p>
        <div className="mt-2 space-y-2">
          {input.activities.map((a, i) => (
            <div key={a.id} className="grid grid-cols-[3rem_1fr_9rem_2rem] items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">{a.id}</span>
              <select value={a.code} onChange={(e) => setAct(i, { code: e.target.value })} className={field}>
                {Object.entries(ACTIVITIES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-zinc-500">GHS m<input type="number" min="0" step="any" value={a.amount / 1e6} onChange={(e) => setAct(i, { amount: Math.round(Number(e.target.value) * 1e6) })} className={`w-full ${field}`} /></label>
              <button type="button" onClick={() => setInput((s) => ({ ...s, activities: s.activities.filter((_, j) => j !== i) }))} className="text-zinc-400 hover:text-red-600" aria-label="Remove activity">✕</button>
              {a.code === 'energy_efficiency' && <label className="col-span-full flex items-center gap-2 text-sm">Energy savings (%)
                <input type="number" min="0" max="100" step="0.01" value={a.efficiencyGainPct ?? ''} onChange={(e) => setAct(i, { efficiencyGainPct: e.target.value === '' ? null : Number(e.target.value) })} className={`w-32 ${field}`} />
              </label>}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <button type="button" onClick={() => setInput((s) => ({ ...s, activities: [...s.activities, { id: crypto.randomUUID(), code: 'general', amount: Math.max(0, fac.ead - allocated) }] }))} className="text-[#3a5a45] underline">+ Add activity</button>
          <span className={allocated > fac.ead ? 'font-semibold text-red-600' : 'text-zinc-500'}>Allocated {m(allocated)} of {m(fac.ead)}{allocated > fac.ead ? ' · exceeds the outstanding' : allocated < fac.ead ? ` · ${m(fac.ead - allocated)} unallocated (counted as unassessed)` : ''}</span>
        </div>
      </section>

      <section>
        <p className="text-sm font-semibold">2 · Questionnaire <span className="font-normal text-zinc-500">({questions.length} questions shown for this sector and these activities · unanswered stays unknown)</span></p>
        <div className="mt-2 divide-y divide-zinc-100 rounded-md ring-1 ring-zinc-200">
          {questions.map((q) => {
            const v = input.responses[q.id] ?? null;
            return (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="max-w-xl"><span className="mr-2 font-mono text-[10px] text-zinc-400">{q.id}</span>{q.text}</span>
                <span className="inline-flex overflow-hidden rounded-md ring-1 ring-zinc-300">
                  {([[true, 'Yes'], [false, 'No'], [null, 'Unknown']] as const).map(([val, label]) => (
                    <button type="button" key={label} onClick={() => setResp(q.id, val)} className={`px-2.5 py-1 text-xs ${v === val ? 'bg-[#1b2c3e] text-white' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}>{label}</button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-sm font-semibold">3 · Evidence <span className="font-normal text-zinc-500">(verification is done by the reviewer)</span></p>
        <div className="mt-2 space-y-2">
          {evidenceIds.map((e) => (
            <div key={e} className="grid items-center gap-2 text-sm md:grid-cols-[1fr_8rem_12rem_10rem]">
              <span>{evidenceLabel(e)}</span>
              <select value={input.evidence[e]?.status === 'provided' ? 'provided' : 'missing'} onChange={(x) => setEv(e, { status: x.target.value as EvidenceStatus })} className={field}>
                <option value="missing">Missing</option><option value="provided">Provided</option>
              </select>
              <input required={input.evidence[e]?.status === 'provided'} aria-label={`Reference for ${evidenceLabel(e)}`} placeholder="document reference" value={input.evidence[e]?.ref ?? ''} onChange={(x) => setEv(e, { ref: x.target.value })} className={field} />
              <input type="date" aria-label={`Document date for ${evidenceLabel(e)}`} value={input.evidence[e]?.date ?? ''} onChange={(x) => setEv(e, { date: x.target.value })} className={field} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md bg-zinc-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Live preview (not saved)</p>
        <p className={`mt-2 inline-block rounded px-2 py-1 text-sm font-medium ring-1 ${TONE[preview.decision.tone]}`}>{preview.decision.label}</p>
        <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
          <p><b>ESMS:</b> gate {preview.esms.gate} · risk {preview.esms.tier}</p>
          <p><b>NDC:</b> {preview.ndc.filter((n) => n.programmes.length).map((n) => `${n.code} ${n.status}`).join('; ') || 'no match'}</p>
          <p><b>Taxonomy:</b> {preview.taxonomy.map((t) => `${m(t.amount)} ${t.status}`).join('; ')}</p>
          <p><b>SDG:</b> {[...new Set(preview.sdg.contributions.flatMap((c) => c.targets))].join(', ') || 'none'}{preview.sdg.adverse.length ? ` · adverse ${preview.sdg.adverse.map((a) => a.target).join(', ')}` : ''}</p>
        </div>
        {!preview.validation.ok && <p className="mt-2 text-sm font-medium text-red-600">{preview.validation.errors.join('; ')}</p>}
      </section>

      <div className="flex items-center gap-3">
        <button className={btnClass} disabled={pending || !preview.validation.ok} data-action="screen-run">{pending ? 'Screening…' : 'Run screening and record'}</button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
