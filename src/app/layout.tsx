import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClimaTRICs Enterprise · Demo',
  description: 'Climate risk, scenario analysis and stress testing (prototype, synthetic data)',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-zinc-900 antialiased">
        <div className="bg-amber-50 px-4 py-1 text-center text-xs text-amber-800">Prototype · synthetic demo portfolio (“Demo Bank Ghana”) · no real customer data · illustrative model parameters</div>
        {children}
      </body>
    </html>
  );
}
