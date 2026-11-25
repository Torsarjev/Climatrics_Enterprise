import { HAZARDS } from '@/lib/params';
import { GRADES, gradeOf, type LoanResult } from '@/lib/engine';
import type { SectorStress } from '@/lib/transmission';
import type { Loan } from '@/lib/portfolio';
import { Table } from './ui';
import { ghs, num, pct, s5 } from '@/lib/fmt';

const grade = (pd: number) => (pd >= 1 ? 'D' : GRADES[gradeOf(pd)]);

export function Explain({ r, loan, sector, staged = false }: { r: LoanResult; loan?: Loan; sector?: SectorStress; staged?: boolean }) {
  const t = r.trace;
  const rows: React.ReactNode[][] = t ? [
    ['Start · Bank PD → implied DSCR (band table)', `${pct(r.pd, 2)} → ${t.dscr.toFixed(2)}×`],
    ['2 Borrower shocks · Revenue (base)', ghs(t.revenue)],
    ['− Ghana GDP shock × sector elasticity', `−${ghs(t.macroLoss)}`],
    ['− Acute flood downtime (chronic heat and rain are in the NGFS GDP path)', `−${ghs(t.physicalLoss)}`],
    ['3 Revenue (stressed)', ghs(t.revenueS)],
    ['3 Operating costs (60% variable + Ghana inflation)', `${ghs(t.opex)} → ${ghs(t.opexS)}`],
    ['− Carbon cost (NGFS carbon price)', `−${ghs(t.carbonCost)}`],
    [<b key="c">4 Stressed CFADS</b>, <b key="cv">{ghs(t.cfads)} → {ghs(t.cfadsS)}</b>],
    ['Debt service (Ghana long-rate shock on floating debt)', `${ghs(t.debtService)} → ${ghs(t.debtServiceS)}`],
    [<b key="d">4 DSCR = CFADS ÷ debt service</b>, <b key="dv" className={t.dscrS < 1 ? 'text-red-600' : ''}>{t.dscr.toFixed(2)}× → {t.dscrS.toFixed(2)}×</b>],
    [<b key="p">5 PD from DSCR band</b>, <b key="pv">{r.pd >= 1 ? 'Default' : `${pct(r.pd, 2)} (${grade(r.pd)}) → ${pct(r.pdStressed, 2)} (${grade(r.pdStressed)})`}</b>],
    ['3 Collateral · 1-in-100-year flood at the site', t.floodDepth > 0 ? `${num(t.floodDepth, 2)} m · ${t.floodCurve} curve → ${pct(t.floodDamage, 0)} damage` : 'below event threshold'],
    ['5 LGD (bank LGD + lost recovery on damaged collateral)', `${pct(r.lgd)} → ${pct(r.lgdStressed)}`],
    [<b key="e">5 {staged ? 'Staged, discounted ECL' : 'One-year ECL = PD × LGD × EAD'}</b>, <b key="ev">{ghs(r.ecl)} → {ghs(r.eclStressed)}</b>],
  ] : sector ? [
    ['Approach', 'Top-down: sector shock, not borrower cash flows'],
    ['Sector PD (EAD-weighted)', `${pct(sector.pd, 2)} → ${pct(sector.pdS, 2)}`],
    ['+ GDP (Ghana shock × sector elasticity)', `+${num(sector.parts.gdp)} log-odds`],
    ['+ Inflation (Ghana)', `+${num(sector.parts.inflation)}`],
    ['+ Long-term rate (Ghana)', `+${num(sector.parts.rate)}`],
    ['+ Carbon price × sector sensitivity', `+${num(sector.parts.carbon)}`],
    ['+ Physical (sector score × added intensity)', `+${num(sector.parts.physical)}`],
    [<b key="p">Borrower PD scaled by the sector ratio</b>, <b key="pv">{r.pd >= 1 ? 'Default' : `${pct(r.pd, 2)} → ${pct(r.pdStressed, 2)}`}</b>],
    ['LGD (bank LGD + sector physical uplift)', `${pct(r.lgd)} → ${pct(r.lgdStressed)}`],
    [<b key="e">{staged ? 'Staged, discounted ECL' : 'One-year ECL = PD × LGD × EAD'}</b>, <b key="ev">{ghs(r.ecl)} → {ghs(r.eclStressed)}</b>],
  ] : [];
  return (
    <>
      {t && <p className="mb-2 text-xs text-zinc-500">1 NGFS scenario (Ghana shocks above) → 2 borrower shocks → 3 revenue, costs and collateral → 4 stressed CFADS and DSCR → 5 PD, LGD and ECL → 6 portfolio total (summary at the top of this run)</p>}
      <Table head={['Step', 'Value']} align={['l', 'r']} rows={rows} />
      <p className="mt-3 text-xs text-zinc-500">
        Physical scores: {HAZARDS.map((h) => `${h} ${s5(r.physicalDrivers[h])}`).join(' · ')} · transition {s5(r.transition)}/5
        {loan && ` · transition plan: ${loan.transitionPlan ? 'yes' : 'no'} · location: ${loan.geoConfidence}`}
      </p>
    </>
  );
}
