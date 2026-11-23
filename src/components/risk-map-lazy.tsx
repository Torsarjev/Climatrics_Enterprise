'use client';

import dynamic from 'next/dynamic';

export const RiskMap = dynamic(() => import('./risk-map'), { ssr: false, loading: () => <div className="grid h-[560px] place-items-center rounded-lg bg-zinc-100 text-sm text-zinc-500">Loading map…</div> });
