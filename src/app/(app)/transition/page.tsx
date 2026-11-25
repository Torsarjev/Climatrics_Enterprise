import { activeLoans } from '@/lib/store';
import { CREDIT, HORIZONS, SCENARIOS, sectorOf } from '@/lib/params';
import { transitionScoreInputs } from '@/lib/engine';
import { PageHead } from '@/components/ui';
import { TransitionWorkspace } from '@/components/transition-workspace';

export const dynamic = 'force-dynamic';

export default async function TransitionPage() {
  const { dataset, loans } = await activeLoans();
  const facilities = loans.map((loan) => ({
    id: loan.id,
    borrowerId: loan.borrowerId ? `borrower:${loan.borrowerId}` : `facility:${loan.id}`,
    borrower: loan.borrower,
    sector: sectorOf(loan.sector).name,
    region: loan.region,
    ead: loan.ead,
    emissionsIntensity: loan.emissionsIntensity,
    plan: loan.transitionPlan,
    inputs: transitionScoreInputs(loan),
  }));
  return (
    <>
      <PageHead area="Transition risk" title="Transition risk workspace" intro="Run a scenario on the active loan book and trace portfolio results back to each borrower and facility." />
      <TransitionWorkspace dataset={{ name: dataset.name, id: dataset.id }} facilities={facilities} scenarios={SCENARIOS}
        horizons={HORIZONS} planRelief={CREDIT.transitionReadinessRelief} />
    </>
  );
}
