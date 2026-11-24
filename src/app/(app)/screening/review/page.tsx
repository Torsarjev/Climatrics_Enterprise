import Link from 'next/link';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { ghs } from '@/lib/fmt';
import { currentUser, resultForScreenRun, rulesHash, screenRuns } from '@/lib/store';

export default async function ScreeningReviewQueue() {
  const user = await currentUser();
  const canApprove = user.can.includes('approve' as never);
  const currentRules = await rulesHash();
  const pending = (await screenRuns()).filter((run) => run.status === 'submitted');

  return (
    <>
      <PageHead area="Engine I" title="Screening review queue"
        intro={canApprove
          ? 'Open a submission to check the ESMS decision, management actions and evidence before recording a decision.'
          : 'Track submitted screenings here. To record a decision in the demo, sign out and sign in as Ama Owusu, the approver.'}>
        <Link href="/screening" className="text-sm underline">Screening register</Link>
      </PageHead>
      <Card title="Awaiting independent review" note={`${pending.length} pending`}>
        {pending.length === 0 ? <p className="text-sm text-zinc-600">There are no submitted screenings in this queue.</p> :
          <Table head={['Borrower and facility', 'Outstanding', 'Submitted by', 'Decision guidance', 'Assessment']} rows={pending.map((run) => {
            const result = resultForScreenRun(run);
            return [
              <span key="borrower"><strong className="block">{run.borrower}</strong>{run.facilityId}</span>,
              ghs(run.input.ead),
              run.submittedBy ?? run.by,
              <div key="decision"><Badge tone={result.decision.tone}>{result.decision.label}</Badge>{run.rulesHash !== currentRules && <p className="mt-1 text-sm text-amber-800">Re-screening required before approval</p>}</div>,
              <Link key="run" href={`/screening/${run.id}#review`} className="font-medium underline">{run.id} · {canApprove ? 'Review' : 'View'}</Link>,
            ];
          })} />}
      </Card>
    </>
  );
}
