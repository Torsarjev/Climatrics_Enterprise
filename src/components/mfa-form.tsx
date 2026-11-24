'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { mfaAction } from '@/app/actions';

export function MfaForm({ setup }: { setup: boolean }) {
  const [state, action, pending] = useActionState(mfaAction, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700">{setup ? 'Enter the 6-digit code now shown in the app' : '6-digit code from your authenticator app'}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
          className="mt-1 w-full rounded-lg bg-white px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-zinc-900 ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#5a8a3c]" />
      </label>
      {state?.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}{state.restart && <> <Link href="/login" className="underline">Back to sign in</Link></>}</p>}
      <button disabled={pending} data-action="verify-mfa" className="w-full rounded-lg bg-[#1b2c3e] py-2.5 text-[15px] font-medium text-white hover:bg-[#24384d] disabled:opacity-60">{pending ? 'Checking…' : setup ? 'Verify and finish setup' : 'Verify'}</button>
      <p className="text-center text-xs text-zinc-500"><Link href="/login" className="underline">Use a different account</Link></p>
    </form>
  );
}
