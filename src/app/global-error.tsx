'use client';

import { ErrorView } from '@/components/error-view';
import './globals.css';

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-zinc-900 antialiased"><ErrorView {...props} /></body>
    </html>
  );
}
