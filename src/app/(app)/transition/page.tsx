import { activeLoans } from '@/lib/store';
import { CREDIT, SECTORS, sectorOf } from '@/lib/params';
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
      <PageHead area="Transition risk" title="Transition risk workspace" intro="Assess an existing or prospective borrower, or calculate transition risk across the active bank loan book." />
      <TransitionWorkspace key={dataset.id} dataset={{ name: dataset.name, id: dataset.id }} facilities={facilities}
        sectorInputs={SECTORS.map((sector) => ({ name: sector.name, sensitivity: sector.transition, benchmark: sector.carbonIntensity }))} planRelief={CREDIT.transitionReadinessRelief} />
    </>
  );
}
