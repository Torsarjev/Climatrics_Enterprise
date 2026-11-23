'use client';

import { useActionState, useRef } from 'react';
import { loginAction } from '@/app/actions';

export function LoginForm({ accounts }: { accounts: { email: string; name: string; role: string }[] }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const field = 'mt-1 w-full rounded-lg bg-white px-3 py-2.5 text-[15px] text-zinc-900 ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#5a8a3c]';
  return (
    <>
      <form action={action} className="space-y-4">
        <label className="block text-sm font-medium text-zinc-700">Work email
          <input ref={email} name="email" type="email" autoComplete="username" required className={field} />
        </label>
        <label className="block text-sm font-medium text-zinc-700">Password
          <input ref={password} name="password" type="password" autoComplete="current-password" required className={field} />
        </label>
        {state?.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} data-action="login" className="w-full rounded-lg bg-[#1b2c3e] py-2.5 text-[15px] font-medium text-white hover:bg-[#24384d] disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-6 border-t border-zinc-200 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Demo accounts</p>
        <ul className="mt-2 space-y-1">
          {accounts.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => { if (email.current) email.current.value = a.email; password.current?.focus(); }}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100" data-account={a.email}>
                <span className="font-medium">{a.name}</span> <span className="text-zinc-500">· {a.role}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Pick an account to fill the email; the password is shared with the demo team.</p>
      </div>
    </>
  );
}
