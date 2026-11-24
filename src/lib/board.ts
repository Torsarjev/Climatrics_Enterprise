import 'server-only';
import { sectorOf } from './params';
import { ghanaShocks } from './calibration';
import { floodAtSite } from './transmission';
import { dashboard } from './dashboard';
import { financedBook } from './emissions';
import { portfolioScreening } from './esg/portfolio';
import { screen } from './esg/engine';
import { effectiveInput, type ScreenRunRecord } from './store';
import type { Loan } from './portfolio';

type Dir = 'max' | 'min';
export interface Limit { id: string; metric: string; formula: string; limit: number; amber: number; dir: Dir; unit: '%' | 'pp' | 't'; owner: string; link: string }

// Board risk appetite (illustrative; configured by GCB's Board Risk Committee). dir 'max' = value must stay below the limit.
export const RISK_APPETITE: Limit[] = [
  { id: 'RA-01', metric: 'Exposure to high-transition sectors without a transition plan', formula: 'EAD in sectors with transition sensitivity ≥ 3.4/5 and no plan ÷ total EAD', limit: 0.3, amber: 0.25, dir: 'max', unit: '%', owner: 'Chief Risk Officer', link: '/transition' },
  { id: 'RA-02', metric: 'Collateral exposed to a 1-in-100-year flood (2050, Current Policies)', formula: 'Collateral value at sites where flood hazard × intensity ≥ event threshold ÷ total collateral', limit: 0.15, amber: 0.1, dir: 'max', unit: '%', owner: 'Head of Credit Risk', link: '/physical' },
  { id: 'RA-03', metric: 'Capital headroom under the most severe NGFS scenario (2050)', formula: 'Stressed total capital ratio − regulatory minimum', limit: 0.01, amber: 0.02, dir: 'min', unit: 'pp', owner: 'Chief Financial Officer', link: '/methodology#capital' },
  { id: 'RA-04', metric: 'Stressed liquidity coverage ratio (most severe scenario)', formula: 'HQLA ÷ stressed 30-day net outflows', limit: 1.0, amber: 1.2, dir: 'min', unit: '%', owner: 'Treasurer / ALCO', link: '/methodology#liquidity' },
  { id: 'RA-05', metric: 'ESMS high-risk exposure', formula: 'EAD of facilities with ESMS risk tier High ÷ total EAD', limit: 0.05, amber: 0.03, dir: 'max', unit: '%', owner: 'Head of Sustainability', link: '/screening/portfolio' },
  { id: 'RA-06', metric: 'Financed emissions intensity', formula: 'Financed tCO₂e ÷ GHS m lent (PCAF)', limit: 400, amber: 350, dir: 'max', unit: 't', owner: 'Head of Sustainability', link: '/emissions' },
];

const fmt = (v: number, u: Limit['unit']) => (u === '%' ? `${(v * 100).toFixed(1)}%` : u === 'pp' ? `${(v * 100).toFixed(1)} pp` : `${v.toFixed(0)} t`);

export async function boardView(loans: Loan[], runs: ScreenRunRecord[], datasetId: string) {
  const asOf = new Date().toISOString();
  const D = dashboard(datasetId, loans);
  const B = financedBook(loans);
  const P = await portfolioScreening(loans, runs, datasetId);
  const worst = D.scenarios.reduce((a, b) => (b.carAfter < a.carAfter ? b : a));
  const worstLcr = D.scenarios.reduce((a, b) => (b.lcrAfter < a.lcrAfter ? b : a));
  const transNoPlan = loans.filter((l) => sectorOf(l.sector).transition >= 0.6 && !l.transitionPlan).reduce((a, l) => a + l.ead, 0);
  const coll = loans.reduce((a, l) => a + l.collateralValue, 0);
  const floodG = ghanaShocks('current', 2050).flood;
  const floodColl = loans.filter((l) => floodAtSite(l, floodG).event).reduce((a, l) => a + l.collateralValue, 0);
  const gps = loans.filter((l) => l.geoConfidence === 'gps').length / loans.length;

  const values: Record<string, { value: number; note: string }> = {
    'RA-01': { value: transNoPlan / D.ead, note: `GHS ${(transNoPlan / 1e9).toFixed(2)}bn` },
    'RA-02': { value: floodColl / coll, note: `GHS ${(floodColl / 1e9).toFixed(2)}bn of collateral · Current Policies 2050 flood intensity` },
    'RA-03': { value: worst.carAfter - worst.minimum, note: `${worst.note} at 2050: ${(worst.carAfter * 100).toFixed(1)}% vs ${(worst.minimum * 100).toFixed(0)}%` },
    'RA-04': { value: worstLcr.lcrAfter, note: `${worstLcr.note} at 2050` },
    'RA-05': { value: P.tier.High.ead / P.ead, note: `${P.tier.High.n} facilities` },
    'RA-06': { value: B.intensity, note: `${(B.total / 1e6).toFixed(2)}m tCO₂e financed` },
  };
  const limits = RISK_APPETITE.map((l) => {
    const v = values[l.id].value;
    const breach = l.dir === 'max' ? v > l.limit : v < l.limit;
    const warn = l.dir === 'max' ? v > l.amber : v < l.amber;
    return { ...l, value: v, display: fmt(v, l.unit), limitDisplay: `${l.dir === 'max' ? '≤' : '≥'} ${fmt(l.limit, l.unit)}`, amberDisplay: fmt(l.amber, l.unit), note: values[l.id].note, status: breach ? 'breach' as const : warn ? 'warning' as const : 'within' as const };
  });

  const kris = [
    { kri: 'Climate ECL uplift, most severe scenario', formula: 'Stressed ECL ÷ baseline ECL − 1', value: `${((D.eclStressed / D.eclBase - 1) * 100).toFixed(0)}%`, quality: 'Model output · illustrative parameters', link: '/methodology#stressed-ecl' },
    { kri: 'High-risk exposure (physical or transition)', formula: 'High-risk EAD ÷ total EAD', value: `${((D.highRisk / D.ead) * 100).toFixed(1)}%`, quality: 'Loan extract + hazard grid', link: '/methodology#high-risk' },
    { kri: 'Taxonomy-aligned exposure', formula: 'Approved aligned activity allocations ÷ total EAD', value: `${(P.alignedRatio * 100).toFixed(2)}%`, quality: 'Approved screenings only', link: '/screening/portfolio' },
    { kri: 'Eligible exposure pending evidence', formula: 'Eligible-pending allocations ÷ total EAD', value: `${((P.tax.pending / P.ead) * 100).toFixed(1)}%`, quality: 'Screening register', link: '/screening/portfolio' },
    { kri: 'Collateral geolocated by GPS', formula: 'Facilities with GPS coordinates ÷ all facilities', value: `${(gps * 100).toFixed(0)}%`, quality: 'Data quality', link: '/data' },
    { kri: 'Financed-emissions data quality (PCAF)', formula: 'Exposure-weighted PCAF score (1 best, 5 worst)', value: B.dqWeighted.toFixed(1), quality: 'Mostly estimated (score 4–5)', link: '/emissions' },
  ];

  const targets = [
    { target: 'Taxonomy-aligned share of the book', baseline: '0.0% (2026)', target2: '5.0% by 2028', actual: `${(P.alignedRatio * 100).toFixed(2)}%`, progress: P.alignedRatio / 0.05, owner: 'Head of Sustainability' },
    { target: 'Facilities with GPS-located collateral', baseline: '72% (Sep 2026)', target2: '95% by 2027', actual: `${(gps * 100).toFixed(0)}%`, progress: (gps - 0.72) / (0.95 - 0.72), owner: 'Chief Data Officer' },
    { target: 'Financed emissions intensity', baseline: `${B.intensity.toFixed(0)} t/GHS m (2026)`, target2: '−20% by 2030', actual: `${B.intensity.toFixed(0)} t/GHS m`, progress: 0, owner: 'Head of Sustainability' },
    { target: 'New loans screened in Engine I before approval', baseline: '0% (2026)', target2: '100% by Q2 2027', actual: `${runs.length} screenings recorded`, progress: Math.min(1, runs.length / 50), owner: 'Head of Credit' },
  ];

  const latest = new Map<string, ScreenRunRecord>();
  [...runs].reverse().forEach((r) => latest.set(r.facilityId, r));
  const actions = [
    ...[...latest.values()].flatMap((r) => screen(effectiveInput(r)).esms.actions.map((a, i) => {
      const due = new Date(new Date(r.createdAt).getTime() + (30 + i * 15) * 864e5);
      return { source: `Screening ${r.id}`, link: `/screening/${r.id}`, subject: `${r.borrower} (${r.facilityId})`, action: a, owner: 'Relationship manager', due: due.toISOString(), status: r.status === 'escalated' ? 'Escalated' : 'Open', overdue: due.getTime() < Date.now() };
    })),
    ...limits.filter((l) => l.status !== 'within').map((l) => ({ source: `Risk appetite ${l.id}`, link: l.link, subject: l.metric, action: l.status === 'breach' ? 'Breach: escalate to Board Risk Committee with a remediation plan' : 'Early warning: report to ALCO / Risk Committee and agree actions', owner: l.owner, due: new Date(Date.now() + 14 * 864e5).toISOString(), status: 'Open', overdue: false })),
  ];
  return { asOf, limits, kris, targets, actions };
}
