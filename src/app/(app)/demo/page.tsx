import Link from 'next/link';
import { currentUser, db } from '@/lib/store';
import { when } from '@/lib/fmt';

const steps = [
  {
    title: 'Validate the loan book',
    href: '/data',
    link: 'Open data ingestion',
    detail: 'As Kofi, load the sample extract. Show the accepted and rejected rows, reconciled control totals and dataset hash.',
  },
  {
    title: 'Explain portfolio exposure',
    href: '/portfolio',
    link: 'Open portfolio management',
    detail: 'Show sector and regional concentrations, then open the physical risk map to explain the exposure behind the numbers.',
  },
  {
    title: 'Run Current Policies 2050',
    href: '/stress',
    link: 'Open scenario analysis',
    detail: 'As Kofi, run the bottom-up scenario. Show the expected credit loss change and open the explanation for a borrower.',
  },
  {
    title: 'Show the capital and liquidity impact',
    href: '/capital',
    link: 'Open ICAAP & ILAAP',
    detail: 'Use the capital bridge to show how credit losses reach the capital ratio, then review the liquidity coverage ratio under stress.',
  },
  {
    title: 'Approve and reproduce the run',
    href: '/governance',
    link: 'Open model governance',
    detail: 'Submit the draft as Kofi. Switch to Ama to approve and verify the run hash. Use Yaw’s read-only view to show the audit trail.',
  },
  {
    title: 'Close with the regulatory pack',
    href: '/reports',
    link: 'Open regulatory reports',
    detail: 'Show the report and its supporting evidence. Use the board dashboard to discuss risk appetite and management actions.',
  },
];

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const user = await currentUser();
  const { activeDataset, datasets, runs } = await db();
  const dataset = datasets.find((item) => item.id === activeDataset);
  const latest = runs[0];

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-[#1b2c3e] px-6 py-7 text-white sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">GCB Bank demo walkthrough</h1>
        <p className="mt-2 max-w-2xl text-slate-200">Follow a synthetic loan book from data validation to a climate stress test, independent approval and regulatory reporting.</p>
        <p className="mt-4 text-sm font-medium text-lime-300">Signed in as {user.name} · {user.role}</p>
      </header>

      <section aria-label="Demo readiness" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Active dataset</h2>
          {dataset ? (
            <>
              <Link href="/data" className="mt-1 inline-block text-sm text-[#3a5a45] underline">{dataset.name}</Link>
              <p className="mt-1 text-sm text-zinc-600">{dataset.control.rowsAccepted.toLocaleString('en-GB')} accepted · {dataset.control.rowsRejected.toLocaleString('en-GB')} rejected</p>
            </>
          ) : <p className="mt-1 text-sm text-zinc-600">Load the synthetic extract to begin.</p>}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Latest stress run</h2>
          {latest ? (
            <Link href={`/runs/${latest.id}`} className="mt-1 inline-block text-sm text-[#3a5a45] underline">
              {latest.id} · {latest.status} · {when(latest.createdAt)}
            </Link>
          ) : <p className="mt-1 text-sm text-zinc-600">Ready for the first run.</p>}
        </div>
      </section>

      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.href} className="flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <p className="mb-4 mt-1 text-zinc-600">{step.detail}</p>
            <Link href={step.href} className="mt-auto rounded-md bg-[#3a5a45] px-3 py-2 text-sm font-medium text-white hover:bg-[#294737]">
              {step.link}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
