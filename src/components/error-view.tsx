'use client';

import { useEffect } from 'react';

// After a redeploy, an open tab can still call the previous build's server actions or chunks.
const STALE = /Failed to find Server Action|ChunkLoadError|Loading chunk|unexpected response was received from the server/i;

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = STALE.test(error.message);
  useEffect(() => {
    if (!stale) return;
    try {
      if (sessionStorage.getItem('clima-reloaded')) return;
      sessionStorage.setItem('clima-reloaded', '1');
    } catch { /* storage blocked: reload anyway */ }
    window.location.reload();
  }, [stale]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{stale ? 'The platform was just updated' : 'Something went wrong on this page'}</h1>
      <p className="mt-2 text-sm text-zinc-600">{stale ? 'Reloading to the latest version…' : 'Your data is safe. Reload the page to continue; if it happens again, note the reference below.'}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={() => { try { sessionStorage.removeItem('clima-reloaded'); } catch {} window.location.reload(); }} className="rounded-md bg-[#1b2c3e] px-4 py-2 text-sm text-white">Reload</button>
        {!stale && <button onClick={reset} className="rounded-md px-4 py-2 text-sm ring-1 ring-zinc-300">Try again</button>}
      </div>
      {error.digest && <p className="mt-4 font-mono text-xs text-zinc-400">ref {error.digest}</p>}
    </div>
  );
}
