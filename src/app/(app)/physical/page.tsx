import { activeLoans } from '@/lib/store';
import { COLLATERAL, HAZARDS, REGIONS, SECTORS, sectorOf } from '@/lib/params';
import { physicalScore } from '@/lib/engine';
import { Bars, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { RiskMap } from '@/components/risk-map-lazy';
import { ghs, pct, s5, to5 } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function PhysicalPage() {
  const { loans } = await activeLoans();
  const scored = loans.map((l) => ({ l, ...physicalScore(l, 1) }));
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const high = scored.filter((s) => s.score >= 0.5);
  const highEad = high.reduce((a, s) => a + s.l.ead, 0);
  const lowConf = scored.filter((s) => s.l.geoConfidence !== 'gps').reduce((a, s) => a + s.l.ead, 0);
  const regionOf = (n: string) => REGIONS.find((r) => r.name === n)!;

  const bySector = SECTORS.map((s) => {
    const xs = scored.filter((x) => x.l.sector === s.key), e = xs.reduce((a, x) => a + x.l.ead, 0) || 1;
    return { label: s.name, value: xs.reduce((a, x) => a + x.score * x.l.ead, 0) / e };
  }).sort((a, b) => b.value - a.value);

  const collAtRisk = Object.entries(COLLATERAL).filter(([k]) => k !== 'none' && k !== 'cash').map(([k, c]) => {
    const xs = loans.filter((l) => l.collateralType === k);
    const atRisk = xs.filter((l) => Math.max(...HAZARDS.map((h) => regionOf(l.region).hazard[h] * c.vuln[h])) >= 0.5);
    return { label: c.name, value: atRisk.reduce((a, l) => a + l.collateralValue, 0) };
  });

  const worst = [...scored].sort((a, b) => b.score * b.l.ead - a.score * a.l.ead).slice(0, 8);

  return (
    <>
      <PageHead area="Engine II · Physical risk" title="Physical risk" intro="Each facility's collateral location is overlaid on hazard layers. Hazard intensity × sector and collateral vulnerability gives a physical risk score from 1 (low) to 5 (very high), today and under each scenario." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="/methodology#high-risk" label="EAD with high physical risk (≥ 3.0 of 5)" value={pct(highEad / ead)} sub={ghs(highEad)} tone="warn" />
        <Stat label="Facilities scored" value={String(scored.length)} sub="4 hazards each" />
        <Stat label="Lower-confidence locations" value={pct(lowConf / ead)} sub="address or region only" />
        <Stat label="Hazard data" value="4 layers" sub="flood · drought · heat · coastal" />
      </div>
      <Card title="Collateral and hazard map" className="mt-6">
        <RiskMap
          points={scored.map(({ l, score, drivers }) => ({ id: l.id, borrower: l.borrower, lat: l.lat, lon: l.lon, ead: l.ead, score, haz: drivers, geo: l.geoConfidence }))}
          regions={REGIONS.map((r) => ({ name: r.name, lat: r.lat, lon: r.lon, hazard: r.hazard }))}
        />
        <Illustrative>Hazard scores are illustrative regional values. Production uses grid-level data (CCKP, ERA5, NASA POWER, Fathom flood depths) at each collateral coordinate.</Illustrative>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Physical risk score by sector" note="EAD-weighted, today"><Bars rows={bySector.map((r) => ({ ...r, value: to5(r.value) }))} format={(n) => n.toFixed(1)} max={5} color="bg-orange-500" /></Card>
        <Card title="Collateral value in high-hazard locations" note="input to LGD haircut"><Bars rows={collAtRisk} format={(n) => ghs(n)} color="bg-orange-500" /></Card>
      </div>
      <Card title="How a score is built: vulnerability matrix" className="mt-6" note="sector vulnerability to each hazard, 1 (low) to 5 (high)">
        <Table head={['Sector', ...HAZARDS]} align={['l', 'r', 'r', 'r', 'r']} rows={SECTORS.map((s) => [s.name, ...HAZARDS.map((h) => s5(sectorOf(s.key).vuln[h]))])} />
        <p className="mt-3 text-xs text-zinc-500">Score = 0.7 × worst (hazard × vulnerability) + 0.3 × average across hazards, shown on a 1–5 scale (1 + 4 × the 0–1 result). Explainable per facility.</p>
      </Card>
      <Card title="Largest physical risk concentrations" className="mt-6">
        <Table head={['Facility', 'Borrower', 'Region', 'EAD', 'Main driver', 'Score']} align={['l', 'l', 'l', 'r', 'l', 'r']} rows={worst.map(({ l, score, drivers }) => {
          const [h, v] = Object.entries(drivers).sort((a, b) => b[1] - a[1])[0];
          return [<span key="i" className="font-mono text-xs">{l.id}</span>, l.borrower, l.region, ghs(l.ead), `${h} (${s5(v)})`, s5(score)];
        })} />
      </Card>
    </>
  );
}
