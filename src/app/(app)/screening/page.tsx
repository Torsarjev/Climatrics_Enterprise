import Link from 'next/link';
import { activeLoans, currentUser, effectiveInput, resultForScreenRun, screenRuns } from '@/lib/store';
import { sectorOf } from '@/lib/params';
import { FRAMEWORK_VERSIONS } from '@/lib/esg/rules';
import { defaultInput, voltaPreset } from '@/lib/esg/portfolio';
import { Badge, Btn, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { ScreenBuilder, type FacilityOption } from '@/components/screen-builder';
import { ghs, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const STATUS_TONE = { draft: 'zinc', submitted: 'amber', approved: 'green', escalated: 'red', returned: 'amber' } as const;

export default async function ScreeningPage({ searchParams }: { searchParams: Promise<{ facility?: string; from?: string }> }) {
  const user = await currentUser();
  const { loans } = await activeLoans();
  const runs = await screenRuns();
  const volta = loans.find((l) => l.id === 'GH-200001');
  const { facility: selectedFacility, from } = await searchParams;
  const previous = runs.find((run) => run.id === from && loans.some((loan) => loan.id === run.facilityId));
  const facilityId = previous?.facilityId ?? selectedFacility;
  const pickList = [...(volta ? [volta] : []), ...loans.filter((loan) => loan !== volta)];
  const facilities: FacilityOption[] = pickList.map((l) => ({
    id: l.id, borrower: l.borrower, sector: l.sector, sectorName: sectorOf(l.sector).name, region: l.region, ead: l.ead,
    preset: l === volta && l.ead > 20_000_000 ? voltaPreset(l) : defaultInput(l),
  }));

  return (
    <>
      <PageHead area="Engine I · Unified ESMS, NDC, taxonomy and SDG screening" title="Sustainability screening" intro="Capture borrower and transaction data once. Review separate results for ESMS, Ghana NDC, the Ghana Green Finance Taxonomy and the UN SDGs. The ESMS decision governs credit progression.">
        <Btn href="/screening/portfolio">Portfolio screening →</Btn>
      </PageHead>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        {['Loan application', 'Validate', 'Dynamic questionnaire', 'Exclusion gate', 'ESMS · NDC · Taxonomy · SDG', 'Evidence review', 'Approval or escalation', 'Portfolio and Engines II–VI'].map((s, i, a) => (
          <span key={s} className="flex items-center gap-2"><span className="rounded bg-white px-2 py-1 ring-1 ring-zinc-200">{s}</span>{i < a.length - 1 && '→'}</span>
        ))}
      </div>

      <Card title="Rule sets in force" note="version-controlled; every run records the versions it used">
        <Table head={['Framework', 'Version', 'Source', 'Status']} rows={Object.values(FRAMEWORK_VERSIONS).map((f) => [<b key="n">{f.name}</b>, <span key="v" className="font-mono text-xs">{f.version}</span>, <a key="s" className="text-xs underline" href={f.url}>{f.source}</a>, <span key="t" className="text-xs text-amber-700">{f.status}</span>])} />
      </Card>

      <Card title="New screening" className="mt-6" note="Choose a facility from the active loan book">
        {user.can.includes('run' as never)
          ? facilities.length ? <ScreenBuilder key={from ?? facilityId} facilities={facilities} initialId={facilityId} previous={previous ? { id: previous.id, input: effectiveInput(previous) } : undefined} /> : <p>No facilities in the active portfolio.</p>
          : <p className="text-sm text-zinc-600">{user.name} ({user.role}) can review screenings but not create them. Switch to an analyst (Kofi Mensah) to run one.</p>}
      </Card>

      <Card title="Screening register" className="mt-6" note="every run is kept; a change creates a new run">
        {runs.length === 0 ? <p className="text-sm text-zinc-500">No screenings yet.</p> : (
          <Table head={['Run', 'When', 'Facility', 'Status', 'ESMS', 'Taxonomy', 'By', 'Replaces']} align={['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']}
            rows={runs.map((r) => {
              const res = resultForScreenRun(r);
              const tax = res.taxonomy.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + t.amount }), {});
              return [
                <Link key="i" href={`/screening/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, when(r.createdAt), `${r.borrower} (${r.facilityId})`,
                <Badge key="s" tone={STATUS_TONE[r.status]}>{r.status}</Badge>, `${res.esms.gate} · ${res.esms.tier}`,
                <span key="t" className="text-xs">{Object.entries(tax).map(([k, v]) => `${k} ${ghs(v)}`).join(' · ')}</span>, r.by, r.parent ?? '—',
              ];
            })} />
        )}
        <Illustrative>Rules are a representative, provisional subset of the official sources named above. IFC rules stand in for GCB’s ESMS policy until it is supplied. Evidence in this demo is synthetic.</Illustrative>
      </Card>
    </>
  );
}
