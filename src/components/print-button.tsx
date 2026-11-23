'use client';

import { btnClass } from './ui';

export function PrintButton() {
  return <button onClick={() => window.print()} className={btnClass}>Print / save PDF</button>;
}
