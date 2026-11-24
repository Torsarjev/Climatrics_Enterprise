import { redirect } from 'next/navigation';
import { USERS, sessionUser } from '@/lib/store';
import { ACCOUNTS } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await sessionUser()) redirect('/');
  const accounts = ACCOUNTS.map((a) => { const u = USERS.find((x) => x.id === a.id)!; return { email: a.email, name: u.name, role: u.role }; });
  return (
    <div className="flex min-h-[calc(100vh-24px)] flex-col lg:flex-row">
      <section className="flex flex-col justify-between bg-gradient-to-b from-[#2b3d52] to-[#14243a] p-8 text-white lg:w-[46%] lg:p-14">
        <div className="flex items-center gap-2 text-2xl font-semibold text-lime-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19c3-4 6-7 10-9" /></svg>
          ClimaTRICs
        </div>
        <div className="my-10">
          <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">Climate risk, from loan book to Board report.</h1>
          <p className="mt-4 max-w-md text-slate-300">Screening, physical and transition risk, NGFS stress testing, ICAAP and ILAAP, financed emissions and regulatory evidence, in one governed workflow.</p>
        </div>
        <p className="text-sm text-slate-400">Prepared for GCB Bank · Demo environment · synthetic loan book, official NGFS and World Bank scenario data</p>
      </section>
      <section className="flex flex-1 items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-zinc-500">Access is role-based. Every sign-in is recorded in the audit trail.</p>
          <LoginForm accounts={accounts} />
        </div>
      </section>
    </div>
  );
}
