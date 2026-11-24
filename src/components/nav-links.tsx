'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const I: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  screening: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  portfolio: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M3 13h18" /></>,
  physical: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  transition: <><path d="M3 21V10l5 3V10l5 3V6l8-3v18z" /><path d="M7 17h2M12 17h2M17 17h1" /></>,
  emissions: <><path d="M7 18a4 4 0 01-.5-8 6 6 0 0111.5 1.5A3.5 3.5 0 0117.5 18z" /></>,
  stress: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  calibration: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  compare: <><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /><path d="M6.5 8v8M17.5 8v8" /></>,
  credit: <><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></>,
  capital: <><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18" /></>,
  sdg: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  disclosure: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 13l2 2 4-4" /></>,
  governance: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  reports: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></>,
  board: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  security: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><rect x="9" y="11" width="6" height="5" rx="1" /><path d="M10 11V9.5a2 2 0 014 0V11" /></>,
  implementation: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 15l2 2 4-4" /></>,
  architecture: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{I[name]}</svg>;
}

export function NavLinks({ items }: { items: string[][] }) {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/credit' && path.startsWith('/runs')));
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible">
      {items.map(([href, label, icon]) => {
        const on = isActive(href);
        return (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] transition-colors ${on ? 'bg-[#3a5a45] font-medium text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white'}`}>
            <span className={on ? 'text-lime-300' : 'text-lime-300/80'}><Icon name={icon} /></span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
