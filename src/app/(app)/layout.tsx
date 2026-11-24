import Link from 'next/link';
import { mfaRequired } from '@/lib/auth';
import { currentUser } from '@/lib/store';
import { logoutAction } from '@/app/actions';
import { NavLinks } from '@/components/nav-links';


const NAV = [
  ['/demo', 'Demo walkthrough', 'reports'],
  ['/', 'Executive dashboard', 'dashboard'],
  ['/board', 'Board & management', 'board'],
  ['/data', 'Data ingestion', 'data'],
  ['/portfolio', 'Portfolio management', 'portfolio'],
  ['/screening', 'Sustainability screening', 'screening'],
  ['/physical', 'Physical risk & GIS', 'physical'],
  ['/transition', 'Transition risk', 'transition'],
  ['/stress', 'Scenario analysis', 'stress'],
  ['/calibration', 'Ghana calibration', 'calibration'],
  ['/compare', 'Top-down vs bottom-up', 'compare'],
  ['/credit', 'Credit risk & ECL', 'credit'],
  ['/capital', 'ICAAP & ILAAP', 'capital'],
  ['/emissions', 'Carbon accounting', 'emissions'],
  ['/screening/portfolio', 'Portfolio screening', 'sdg'],
  ['/disclosure', 'IFRS S2 disclosure', 'disclosure'],
  ['/reports', 'Regulatory reports', 'reports'],
  ['/governance', 'Model governance', 'governance'],
  ['/methodology', 'Methodology', 'disclosure'],
  ['/architecture', 'Architecture', 'architecture'],
  ['/security', 'Security & integrations', 'security'],
  ['/implementation', 'Implementation & support', 'implementation'],
];

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <>
        <header className="bg-gradient-to-b from-[#2b3d52] to-[#14243a] text-white">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-lime-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19c3-4 6-7 10-9" /></svg>
              ClimaTRICs
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="hidden text-slate-200 md:inline">Prepared for GCB Bank | Demo environment</span>
              <span className="hidden items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 md:inline-flex" title={mfaRequired ? 'Signed in with password and authenticator code (TOTP). Signed 8-hour session with lockout. SSO through GCB’s identity provider in production.' : 'MFA is switched off on this server (MFA_MODE=off).'}>● Signed in · {mfaRequired ? 'MFA verified' : 'MFA off'}</span>
              <Link href="/account" className="text-right leading-tight hover:underline" data-user={user.id}><span className="block font-medium">{user.name}</span><span className="block text-xs text-slate-300">{user.role}</span></Link>
              <form action={logoutAction}><button className="rounded-md px-3 py-1.5 text-sm text-white ring-1 ring-white/30 hover:bg-white/10" data-action="logout">Sign out</button></form>
            </div>
          </div>
        </header>
        <div className="lg:flex">
          <aside className="bg-[#1b2c3e] lg:w-72 lg:shrink-0">
            <div className="lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto"><NavLinks items={NAV} /></div>
          </aside>
          <div className="min-w-0 flex-1">
            {user.can.length === 0 && <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-800">Read-only access · {user.name}, {user.role}. You can view every screen, the lineage and the audit trail, but cannot load data, run or approve.</div>}
            <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
          </div>
        </div>
    </>
  );
}
