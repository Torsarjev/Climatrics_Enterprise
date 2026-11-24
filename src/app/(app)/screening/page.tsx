import Link from 'next/link';
import { activeLoans, currentUser, effectiveInput, screenRuns } from '@/lib/store';
import { sectorOf } from '@/lib/params';
import { FRAMEWORK_VERSIONS } from '@/lib/esg/rules';
import { screen } from '@/lib/esg/engine';
import { defaultInput, voltaPreset } from '@/lib/esg/portfolio';
import { Badge, Btn, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { ScreenBuilder, type FacilityOption } from '@/components/screen-builder';
import { ghs, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const STATUS_TONE = { draft: 'zinc', submitted: 'amber', approved: 'green', escalated: 'red', returned: 'amber' } as const;

export default async function ScreeningPage() {
  const user = await currentUser();
  const { loans } = await activeLoans();
  const runs = await screenRuns();
  const volta = loans.find((l) => l.id === 'GH-200001');
  const pickList = [...(volta ? [volta] : []), ...loans.filter((l) => l.sector === 'renew').slice(0, 15), ...[...loans].sort((a, b) => b.ead - a.ead).slice(0, 25)];
  const seen = new Set<string>();
  const facilities: FacilityOption[] = pickList.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true))).map((l) => ({
    id: l.id, borrower: l.borrower, sector: l.sector, sectorName: sectorOf(l.sector).name, region: l.region, ead: l.ead,
    preset: l.id === 'GH-200001' ? voltaPreset(l) : defaultInput(l),
  }));

  return (
    <>
      <PageHead area="Engine I · Unified ESMS, NDC, taxonomy and SDG screening" title="Sustainability screening" intro="Borrower and transaction data are captured once. Four independent rule sets (ESMS, Ghana NDC, Green Taxonomy, SDG) each give their own result; there is no composite score, and sustainability tags never override an ESMS restriction.">
        <Btn href="/screening/portfolio">Portfolio screening →</Btn>
      </PageHead>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        {['Loan application', 'Validate', 'Dynamic questionnaire', 'Exclusion gate', 'ESMS · NDC · Taxonomy · SDG', 'Evidence review', 'Approval or escalation', 'Portfolio and Engines II–VI'].map((s, i, a) => (
          <span key={s} className="flex items-center gap-2"><span className="rounded bg-white px-2 py-1 ring-1 ring-zinc-200">{s}</span>{i < a.length - 1 && '→'}</span>
        ))}
      </div>

      <Card title="Rule sets in force" note="version-controlled; every run records the versions it used">
        <Table head={['Framework', 'Version', 'Source', 'Status']} rows={Object.values(FRAMEWORK_VERSIONS).map((f) => [<b key="n">{f.name}</b>, <span key="v" className="font-mono text-xs">{f.version}</span>, <span key="s" className="text-xs">{f.source}</span>, <span key="t" className="text-xs text-amber-700">{f.status}</span>])} />
      </Card>

      <Card title="New screening" className="mt-6" note="prefilled with Volta Agro Processing: edit any field">
        {user.can.includes('run' as never)
          ? <ScreenBuilder facilities={facilities} />
          : <p className="text-sm text-zinc-600">{user.name} ({user.role}) can review screenings but not create them. Switch to an analyst (Kofi Mensah) to run one.</p>}
      </Card>

      <Card title="Screening register" className="mt-6" note="every run is kept; a change creates a new run">
        {runs.length === 0 ? <p className="text-sm text-zinc-500">No screenings yet.</p> : (
          <Table head={['Run', 'When', 'Facility', 'Status', 'ESMS', 'Taxonomy', 'By', 'Replaces']} align={['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']}
            rows={runs.map((r) => {
              const res = screen(effectiveInput(r));
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
