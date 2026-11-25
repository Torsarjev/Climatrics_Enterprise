import { MOCK_DISCLOSURES } from '@/lib/mock-disclosures';
import Link from 'next/link';
import { Badge, Card, PageHead, Table } from './ui';
import { CreateRegulatoryForm, DisclosureEditor, RegulatoryReview } from './regulatory-forms';
import { disclosureGaps, EVIDENCE_KIND, FRAMEWORKS, GUIDANCE, REGISTER_VERSION, REQUIREMENTS, type RegulatoryPack, type SourceEvidence } from '@/lib/regulatory';
import { when } from '@/lib/fmt';
import type { User } from '@/lib/store';

const steps = [
  ['Approved bank and model outputs', 'Board records · Engines I–III and V · ICAAP · ILAAP'],
  ['Disclosure and policy data', 'IFRS paragraphs · BoG directive · reporting scope'],
  ['Evidence and gap mapping', 'Requirement → owner → source → draft disclosure'],
  ['Controlled outputs and sign-off', 'Independent review · disclosure schedule · evidence export'],
];
const statusLabel = (status: RegulatoryPack['status']) => status === 'approved' ? 'Signed off' : status === 'submitted' ? 'In review' : status === 'returned' ? 'Returned' : 'Draft';

export function RegulatoryWorkspace({ pack, history, sources, user, standard, requirement, filter }: {
  pack?: RegulatoryPack; history: RegulatoryPack[]; sources: SourceEvidence[]; user: User; standard?: string; requirement?: string; filter?: string;
}) {
  const maker = user.can.includes('run' as never);
  const checker = user.can.includes('approve' as never);
  const mayEdit = maker && pack?.status === 'draft' && pack.by === user.name;
  const register = pack?.rows.map((row) => row.requirement) ?? REQUIREMENTS;
  const statusById = new Map(pack?.rows.map((row) => [row.requirement.id, disclosureGaps(row)]));
  const complete = pack?.rows.filter((row) => !disclosureGaps(row).length && row.applicability === 'applicable').length ?? 0;
  const excluded = pack?.rows.filter((row) => !disclosureGaps(row).length && row.applicability === 'not-applicable').length ?? 0;
  const total = pack?.rows.length ?? register.length;
  const gaps = total - complete - excluded;
  const selected = register.find((item) => item.id === requirement);
  const selectedRow = pack?.rows.find((row) => row.requirement.id === requirement);
  const example = selected ? MOCK_DISCLOSURES[selected.id] : undefined;
  const sourceFramework = selected ? (pack?.standards ?? FRAMEWORKS)[selected.framework] : undefined;
  const route = (overrides: Record<string, string> = {}) => `/reports?${new URLSearchParams({
    ...(pack ? { pack: pack.id } : {}), ...(standard ? { standard } : {}), ...(filter ? { filter } : {}), ...overrides,
  })}`;
  const visible = register.filter((row) => (!standard || row.framework === standard) && (filter !== 'gaps' || (statusById.get(row.id)?.length ?? 1) > 0));
  return <>
    <PageHead area="Engine IV · Disclosure and regulatory reporting" title="Regulatory reporting workspace" intro="Map IFRS S1, IFRS S2 and Bank of Ghana requirements to source evidence, then review and sign off the disclosure pack.">
      <Link className="text-sm underline" href="/reports?view=stress">Open climate stress pack</Link>
    </PageHead>

    <section aria-label="Disclosure workflow" className="mb-6 grid gap-1 overflow-hidden rounded-2xl bg-lime-200 sm:grid-cols-2">
      {steps.map(([label, detail], index) => <div key={label} className={`p-4 sm:p-5 ${index >= 2 ? 'bg-lime-100 sm:col-span-2' : 'bg-[#173526] text-white'}`}>
        <h2 className="font-semibold">{label}</h2><p className={`mt-1 text-sm ${index >= 2 ? 'text-zinc-700' : 'text-lime-100'}`}>{detail}</p>
      </div>)}
    </section>

    {pack && <Card className="mb-6" title="Reporting pack" note={<Badge tone={pack.status === 'approved' ? 'green' : 'amber'}>{statusLabel(pack.status)}</Badge>}>
      <p className="text-sm font-medium">{pack.entity} · {pack.periodStart} to {pack.periodEnd} · Revision {pack.revision}</p>
      <p className="mt-2 break-words text-sm text-zinc-600">{pack.id} · Register {pack.version} · {pack.by} · {when(pack.at)}</p>
      {pack.previousId && <Link href={`/reports?pack=${pack.previousId}`} className="mt-2 inline-block text-sm underline">Previous revision</Link>}
      {pack.reviewer && <p className="mt-2 text-sm">Decision by {pack.reviewer} · {when(pack.reviewedAt!)} · {pack.reviewNote || 'No note entered'}</p>}
      {pack.hash && <p className="mt-2 break-all text-xs text-zinc-600">Signed disclosure input fingerprint {pack.hash}</p>}
      <div className="my-4 flex flex-wrap gap-4 text-sm">
        <a className="underline" href={`/api/regulatory?id=${pack.id}`}>Export evidence and audit JSON</a>
        <a className="underline" href={`/api/regulatory?id=${pack.id}&format=csv`}>Download disclosure schedule CSV</a>
        {pack.status === 'approved' && <a className="underline" href={`/api/regulatory?id=${pack.id}&format=publication`}>Download signed publication pack</a>}
      </div>
      {mayEdit && <RegulatoryReview id={pack.id} mode="submit" />}
      {checker && pack.status === 'submitted' && pack.by !== user.name && <RegulatoryReview id={pack.id} mode="review" />}
      {maker && pack.by === user.name && (pack.status === 'returned' || pack.status === 'approved') && <RegulatoryReview id={pack.id} mode="revise" />}
    </Card>}

    <Card title="Requirement and evidence register" className="mb-6" note={pack?.version ?? REGISTER_VERSION}>
      <p className="mb-3 text-sm text-zinc-600">Open a requirement to see its mock disclosure and the evidence to collect.</p>
      <nav aria-label="Disclosure register filters" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[['', 'All frameworks'], ...Object.entries(FRAMEWORKS).map(([key, value]) => [key, value.title])].map(([key, label]) => (
          <Link key={key} href={route({ standard: key })} aria-current={(standard ?? '') === key ? 'page' : undefined}
            className="rounded-md border border-zinc-200 px-3 py-2 hover:bg-lime-50 aria-[current=page]:border-lime-600 aria-[current=page]:bg-lime-100">{label}</Link>
        ))}
      </nav>
      {pack && <>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-lime-100 p-3 text-sm"><b>{complete}</b> applicable requirements ready for review</div>
          <Link href={route({ filter: filter === 'gaps' ? '' : 'gaps' })} aria-pressed={filter === 'gaps'} className="rounded-lg bg-amber-50 p-3 text-sm underline"><b>{gaps}</b> open gaps · {filter === 'gaps' ? 'Show all' : 'View gaps'}</Link>
          <div className="rounded-lg bg-zinc-100 p-3 text-sm"><b>{excluded}</b> documented exclusions</div>
        </div>
        <p className="mb-3 text-sm text-zinc-600">Evidence completeness {total - excluded ? Math.round(100 * complete / (total - excluded)) + '%' : '—'}. A ready item has an owner, a draft narrative and every mapped evidence type. Documented exclusions are reviewed at sign-off.</p>
      </>}
      {!visible.length && <p className="text-sm text-zinc-600">No requirements match these filters.</p>}
      <Table head={['Reference', 'Disclosure requirement', 'Owner', 'Evidence / gap']} rows={visible.map((row) => {
        const entry = pack?.rows.find((item) => item.requirement.id === row.id);
        const missing = statusById.get(row.id);
        return [
          `${(pack?.standards ?? FRAMEWORKS)[row.framework].title} · ${row.paragraph}`,
          <Link key={row.id} className="font-medium underline" href={route({ requirement: row.id }) + '#requirement-detail'}>{row.title}</Link>,
          entry?.owner ?? row.owner,
          missing ? (missing.length ? `${missing.length} open · ${missing.join(', ')}` : entry?.applicability === 'not-applicable' ? 'Excluded · rationale recorded' : 'Ready') :
            row.evidence.map((kind) => EVIDENCE_KIND[kind]).join(' · '),
        ];
      })} />
    </Card>

    {selected && sourceFramework && <div id="requirement-detail" className="mb-6 scroll-mt-5">
      <Card title={selected.title} note={`${sourceFramework.title} · ${selected.paragraph}`}>
        <p className="text-sm">{selected.pillar} · {sourceFramework.version} · <a href={sourceFramework.uri} className="underline">Source standard or directive</a></p>
        <p className="mt-2 text-sm">Mapped evidence · {selected.evidence.map((kind) => EVIDENCE_KIND[kind]).join(' · ')}</p>
        {example && <section aria-label="Mock disclosure" className="mt-4 rounded-lg border border-lime-300 bg-lime-50 p-4 text-sm">
          <h3 className="font-semibold">Mock disclosure · {selectedRow?.owner ?? selected.owner}</h3>
          <p className="mt-2">{example}</p>
          <p className="mt-2 text-zinc-700">Replace every double-bracketed placeholder with verified information and link the supporting evidence before sign-off.</p>
        </section>}
        {selectedRow && <div className="mt-3 space-y-3 text-sm">
          <p>Applicability {selectedRow.applicability} · Owner {selectedRow.owner}</p>
          {selectedRow.rationale && <p className="whitespace-pre-wrap">{selectedRow.rationale}</p>}
          {selectedRow.narrative && <p className="whitespace-pre-wrap">{selectedRow.narrative}</p>}
          {selectedRow.evidence.map((item) => <details key={item.id} className="rounded border border-lime-200 bg-lime-50 p-3">
            <summary className="cursor-pointer font-medium">{item.label} · {item.approvalState}</summary>
            <div className="mt-2 space-y-1">
              <p>{item.provider} · {item.version} · Retrieved {when(item.retrievedAt)}</p>
              <p>{item.units} · {item.resolution} · Retention {item.retention}</p>
              <p>{item.methodology}. {item.limitations}</p>
              <p>Source {item.sourceApproval}{item.sourceReviewer ? ` by ${item.sourceReviewer}` : ''} · Disclosure reviewer {item.reviewer ?? 'pending'}</p>
              {item.uri && <a className="underline" href={item.uri}>Open linked evidence</a>}
              {item.hash && <p className="break-all">Source fingerprint {item.hash}</p>}
              {!!item.metrics?.length && <Table head={['Source measure', 'Value', 'Unit']} rows={item.metrics.map((metric) => [metric.label, metric.value.toLocaleString('en-GB', { maximumFractionDigits: 2 }), metric.unit])} /> }
            </div>
          </details>)}
        </div>}
        {mayEdit && pack && selectedRow && <DisclosureEditor key={`${pack.id}:${selected.id}`} pack={pack.id} row={selectedRow} sources={sources} example={example} />}
      </Card>
    </div>}

    {maker && <Card title="Create a reporting pack" className="mb-6"><CreateRegulatoryForm /></Card>}
    <Card title="Saved reporting packs" className="mb-6">
      {history.length ? <Table head={['Entity', 'Period end', 'Frameworks', 'Revision', 'Status']} rows={history.map((item) => [
        <Link key={item.id} className="underline" href={`/reports?pack=${item.id}`}>{item.entity}</Link>, item.periodEnd,
        item.frameworks.map((key) => item.standards[key].title).join(', '), item.revision, statusLabel(item.status),
      ])} /> : <p className="text-sm text-zinc-600">No disclosure packs have been saved.</p>}
    </Card>
    <Card title="Applicable standards and guidance">
      <p className="mb-3 text-sm text-zinc-700">This version covers the mapped paragraphs and clauses shown above. GCB Legal and Compliance must confirm interpretation, applicability, reporting templates and effective dates. Sign-off records human review of the pack and its evidence.</p>
      <ul className="space-y-1 text-sm">{[...Object.values(FRAMEWORKS).map(({ title, version, uri }) => [`${title} · ${version}`, uri]), ...GUIDANCE].map(([title, uri]) => <li key={uri}><a className="underline" href={uri}>{title}</a></li>)}</ul>
    </Card>
  </>;
}
