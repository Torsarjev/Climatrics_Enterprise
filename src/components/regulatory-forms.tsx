'use client';

import { useActionState, useState } from 'react';
import { createRegulatoryAction, reviewRegulatoryAction, saveDisclosureAction } from '@/app/actions/regulatory';
import { EVIDENCE_KIND, FRAMEWORKS, type DisclosureRow, type SourceEvidence } from '@/lib/regulatory';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm';
const errorText = (state: { error: string } | null) => state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>;

export function CreateRegulatoryForm() {
  const [state, action, pending] = useActionState(createRegulatoryAction, null);
  return <form action={action} className="space-y-3">
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm font-medium">Reporting entity<input name="entity" required maxLength={160} className={field} /></label>
      <label className="text-sm font-medium">Period from<input name="periodStart" type="date" required className={field} /></label>
      <label className="text-sm font-medium">Period to<input name="periodEnd" type="date" required className={field} /></label>
    </div>
    <fieldset className="flex flex-wrap gap-4 text-sm">
      <legend className="mb-2 font-medium">Frameworks in scope</legend>
      {Object.entries(FRAMEWORKS).map(([key, framework]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" name="framework" value={key} defaultChecked />{framework.title}</label>)}
    </fieldset>
    <button className={btnClass} disabled={pending}>Create disclosure pack</button>
    {errorText(state)}
  </form>;
}

export function DisclosureEditor({ pack, row, sources, example }: { pack: string; row: DisclosureRow; sources: SourceEvidence[]; example?: string }) {
  const [state, action, pending] = useActionState(saveDisclosureAction, null);
  const [method, setMethod] = useState('none');
  const [narrative, setNarrative] = useState(row.narrative);
  const [applicability, setApplicability] = useState(row.applicability);
  const types = row.requirement.evidence;
  const matches = sources.filter((item) => types.includes(item.kind));
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="pack" value={pack} /><input type="hidden" name="requirement" value={row.requirement.id} />
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Control owner<input name="owner" defaultValue={row.owner} required maxLength={160} className={field} /></label>
      <label className="text-sm font-medium">Applicability<select name="applicability" value={applicability} onChange={(event) => setApplicability(event.target.value as DisclosureRow['applicability'])} className={field}>
        <option value="pending">Pending assessment</option><option value="applicable">Applicable</option><option value="not-applicable">Not applicable</option>
      </select></label>
    </div>
    <label className="block text-sm font-medium">Applicability rationale<input name="rationale" required={applicability === 'not-applicable'} maxLength={2000} defaultValue={row.rationale} className={field} /></label>
    <label className="block text-sm font-medium">Draft disclosure narrative<textarea name="narrative" rows={5} maxLength={12000}
      value={narrative} onChange={(event) => setNarrative(event.target.value)} className={field} /></label>
    {example && <div className="text-sm">
      <button type="button" className="rounded-md border border-lime-600 px-3 py-2 font-medium disabled:opacity-50"
        disabled={!!narrative.trim()} onClick={() => setNarrative(example)}>Use mock disclosure in draft</button>
      {narrative.trim() && <p className="mt-1 text-zinc-600">This action is available when the narrative is empty.</p>}
    </div>}
    <label className="block text-sm font-medium">Attach evidence
      <select value={method} onChange={(event) => setMethod(event.target.value)} className={field}>
        <option value="none">Keep current evidence</option>
        <option value="internal">Link an approved source or capture a model snapshot</option>
        <option value="document">Register a bank document</option>
      </select>
    </label>
    {method === 'internal' && <label className="block text-sm font-medium">Source record<select name="source" className={field} defaultValue="" required>
      <option value="">Select evidence</option>
      {matches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      {types.includes('physical') && <option value="physical-snapshot">Capture Engine II portfolio physical risk</option>}
      {types.includes('emissions') && <option value="emissions-snapshot">Capture Engine V financed emissions estimate</option>}
    </select></label>}
    {method === 'document' && <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Evidence type<select name="kind" className={field} required defaultValue="">
        <option value="">Choose evidence type</option>{types.map((key) => <option key={key} value={key}>{EVIDENCE_KIND[key]}</option>)}
      </select></label>
      {([
        ['label', 'Document title', 160, true], ['provider', 'Source system or provider', 160, true],
        ['uri', 'HTTPS document URI', 500, false], ['hash', 'Document SHA-256', 64, false],
        ['sourceVersion', 'Document, dataset or model version', 240, true], ['units', 'Variable units (or N/A)', 100, true],
        ['resolution', 'Spatial and temporal resolution', 240, true], ['methodology', 'Methodology', 800, true], ['limitations', 'Limitations', 800, true],
      ] as const).map(([name, label, limit, required]) => <label key={name} className="text-sm font-medium">{label}
        <input name={name} maxLength={limit} required={required} className={field} />
      </label>)}
    </div>}
    {method !== 'none' && <label className="block text-sm font-medium">Retention classification<input name="retention" maxLength={120} required className={field} /></label>}
    {row.evidence.length > 0 && <label className="block text-sm font-medium">Remove linked evidence<select name="remove" className={field}>
      <option value="">Keep all links</option>{row.evidence.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>}
    <button className={btnClass} disabled={pending}>Save requirement and evidence</button>
    {errorText(state)}
  </form>;
}

export function RegulatoryReview({ id, mode }: { id: string; mode: 'submit' | 'review' | 'revise' }) {
  const [state, action, pending] = useActionState(reviewRegulatoryAction, null);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="pack" value={id} />
    {mode === 'review' ? <>
      <label className="block text-sm font-medium">Decision<select name="decision" defaultValue="return" className={field}>
        <option value="return">Return for revision</option><option value="approve">Sign off for publication</option>
      </select></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmScope" value="yes" />I confirm reporting scope, applicability, evidence relevance, and the applicable legal and compliance review.</label>
      <label className="block text-sm font-medium">Review note<textarea name="note" rows={2} maxLength={2000} className={field} /></label>
    </> : <input type="hidden" name="decision" value={mode} />}
    <button className={btnClass} disabled={pending}>{mode === 'review' ? 'Record decision' : mode === 'revise' ? 'Create a new revision' : 'Submit for independent review'}</button>
    {errorText(state)}
  </form>;
}
