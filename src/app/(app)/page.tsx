import Link from 'next/link';
import { activeLoans, currentUser, db } from '@/lib/store';
import { MyWork } from '@/components/my-work';
import { scenarioOf, sectorOf } from '@/lib/params';
import { Badge, Card, Table } from '@/components/ui';
import { ghs, pct, to5, when } from '@/lib/fmt';
import { boardView } from '@/lib/board';
import { assessPortfolio } from '@/lib/physical-risk';
import { transitionScoreInputs } from '@/lib/engine';
import { transitionScoreFromInputs } from '@/lib/transition-model';

export const dynamic = 'force-dynamic';

export default async function Overview({searchParams}: {searchParams: Promise<{order?:string}>}) {
  const [d, user, { dataset, loans }, query] = await Promise.all([db(), currentUser(), activeLoans(), searchParams]);
  const screenings = (d.screenRuns ?? []).filter(r => r.datasetId === dataset.id);
  const runs = d.runs.filter(r => r.datasetId === dataset.id && r.datasetHash === dataset.hash);
  const latest = runs[0];
  const scenario = runs.find(r => r.status === 'approved') ?? runs.find(r => r.status !== 'rejected');
  const board = await boardView(loans, screenings, dataset.id);
  const {facilities} = assessPortfolio(loans, screenings, dataset.id);
  const ead = loans.reduce((sum,l) => sum + l.ead, 0);
  const grouped = new Map<string,{name:string;ead:number;physical:number;transition:number}>();
  for (const {loan, physical} of facilities) {
    const name = sectorOf(loan.sector).name;
    const sector = grouped.get(name) ?? {name,ead:0,physical:0,transition:0};
    sector.ead += loan.ead;
    sector.physical += physical * loan.ead;
    sector.transition += to5(transitionScoreFromInputs(transitionScoreInputs(loan),1)) * loan.ead;
    grouped.set(name,sector);
  }
  const sectors = [...grouped.values()].map(s => {
    const physical = s.physical/s.ead, transition = s.transition/s.ead;
    return {...s, physical, transition, risk: Math.max(physical,transition)};
  }).sort((a,b) => b.risk-a.risk || b.ead-a.ead);
  const exposure = [...sectors].sort((a,b) => b.ead-a.ead || a.name.localeCompare(b.name));
  const breaches = board.limits.filter(l => Number.isFinite(l.value) && l.status === 'breach');
  const pack = d.regulatory?.[0];
  const sources = [
    ['I','Sustainability screening',board.kris[2].value+' taxonomy aligned','/screening/portfolio'],
    ['II','Physical risk',ghs(facilities.filter(f => f.physical >= 3).reduce((sum,f)=>sum+f.loan.ead,0))+' high-risk exposure','/physical'],
    ['III','Scenario losses',scenario ? ghs(scenario.headline.eclStressed)+' stressed ECL · '+scenario.status+' · '+scenario.input.horizon : 'Awaiting a scenario run on this book',scenario ? '/runs/'+scenario.id : '/stress'],
    ['IV','Regulatory disclosures',pack ? pack.entity+' · '+pack.periodEnd+' · '+pack.status : 'No reporting pack created',pack ? '/reports?pack='+pack.id : '/reports'],
    ['V','Financed emissions',board.limits.find(l=>l.id==='RA-06')!.display+' CO₂e / GHS m lent','/emissions'],
    ['VI','Data and model governance',dataset.control.rowsAccepted+' accepted · '+dataset.control.rowsRejected+' rejected · stored extract verified','/governance'],
  ];
  return (<>
    <section className="rounded-2xl bg-[#163a31] p-6 text-white sm:p-8">
      <p className="text-sm text-lime-200">Executive dashboard · Board climate risk</p>
      <h1 className="mt-3 text-4xl font-semibold">{ghs(ead)} in portfolio exposure</h1>
      <p className="mt-2">{loans.length.toLocaleString()} facilities · {dataset.name}</p>
      <div className="mt-5 grid gap-4 border-t border-white/25 pt-4 sm:grid-cols-3">
        <a href="#appetite"><b>{breaches.length} appetite breaches</b><br/>Review limits and owners ↓</a>
        <a href="#sectors"><b>{sectors[0]?.name ?? '—'}</b><br/>Highest climate risk score ↓</a>
        <a href="?order=exposure#sectors"><b>{exposure[0]?.name ?? '—'}</b><br/>Largest sector exposure ↓</a>
      </div>
    </section>
    <section id="appetite" className="mt-6"><Card title="Board climate risk appetite" note={<Link href="/board" className="underline">Board actions →</Link>}>
      <p className="mb-3 text-sm text-zinc-600">Illustrative Board limits. Portfolio measures use the active extract. Flood, capital and liquidity measures use modelled 2050 stress outcomes.</p>
      <Table head={['Indicator','Actual / modelled','Appetite','Early warning','Position','Accountable owner']} rows={board.limits.map(l=>[
        <Link key="metric" href={l.link} className="underline">{l.metric}</Link>,Number.isFinite(l.value)?l.display:'Unavailable',l.limitDisplay,l.amberDisplay,
        <Badge key="status" tone={!Number.isFinite(l.value)?'zinc':l.status==='breach'?'red':l.status==='warning'?'amber':'green'}>{Number.isFinite(l.value)?l.status:'Unassessed'}</Badge>,l.owner
      ])}/>
    </Card></section>
    <section id="sectors" className="mt-6"><Card title="Sector risk and concentration" note={<div className="flex gap-3"><Link href="/?order=risk#sectors" className="underline">Rank by risk</Link><Link href="/?order=exposure#sectors" className="underline">Rank by exposure</Link></div>}>
      <p className="mb-3 text-sm text-zinc-600">Each component is weighted by facility exposure. The higher sector component determines the monitoring band. High ≥ 3, moderate ≥ 2, low below 2 on a five-point scale. These demo bands guide sector monitoring.</p>
      <Table head={['Sector','Monitoring band','Physical / 5','Transition / 5','Exposure','Portfolio share']} rows={(query.order==='exposure'?exposure:sectors).map(s=>[
        s.name,<Badge key="risk" tone={s.risk>=3?'red':s.risk>=2?'amber':'green'}>{s.risk>=3?'High':s.risk>=2?'Moderate':'Low'}</Badge>,s.physical.toFixed(2),s.transition.toFixed(2),ghs(s.ead),
        <div key="share">{pct(s.ead/ead)}<div className="h-1.5 rounded bg-zinc-100"><div className="h-full rounded bg-lime-600" style={{width:pct(s.ead/ead)}}/></div></div>
      ])}/>
    </Card></section>
    <Card title="Engine outputs" className="mt-6"><div className="grid gap-3 md:grid-cols-3">{sources.map(([id,label,value,url])=><Link key={id} href={url} className="rounded-lg border border-zinc-200 p-4 hover:border-lime-600"><p className="text-xs text-emerald-800">Engine {id}</p><h3 className="my-1 font-semibold">{label}</h3><p className="text-sm">{value}</p></Link>)}</div></Card>
    <div className="mt-6"><MyWork user={user} runs={d.runs} audit={d.audit}/></div>
      <Card title="Recent stress runs" className="mt-6" note={latest ? `latest ${when(latest.createdAt)}` : undefined}>
        {runs.length === 0 ? <p className="text-sm text-zinc-500">No runs yet. <Link href="/stress" className="underline">Run a stress test</Link>.</p> : (
          <Table
            head={['Run', 'Scenario', 'Horizon', 'ECL before → after', 'CAR after', 'Status']}
            align={['l', 'l', 'l', 'r', 'r', 'l']}
            rows={runs.slice(0, 6).map((r) => [
              <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>,
              scenarioOf(r.input.scenario).name, `${r.input.horizon} · ${r.input.approach}`,
              `${ghs(r.headline.ecl)} → ${ghs(r.headline.eclStressed)}`,
              <span key="c" className={r.headline.carAfter < 0.13 ? 'text-red-600' : ''}>{pct(r.headline.carAfter)}</span>,
              <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
            ])}
          />
        )}
      </Card>
    </>
  );
}
