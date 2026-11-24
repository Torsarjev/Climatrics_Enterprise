import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCOUNTS, MFA_COOKIE, readMfaPending } from '@/lib/auth';
import { USERS, mfaEnrolledAt } from '@/lib/store';
import { authenticatorSetup } from '@/lib/qr';
import { MfaForm } from '@/components/mfa-form';

export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  const id = readMfaPending((await cookies()).get(MFA_COOKIE)?.value);
  if (!id) redirect('/login');
  const user = USERS.find((u) => u.id === id)!;
  const email = ACCOUNTS.find((a) => a.id === id)!.email;
  const enrolled = await mfaEnrolledAt(id);
  const setup = enrolled ? null : await authenticatorSetup(id, email);

  return (
    <div className="flex min-h-[calc(100vh-24px)] items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Step 2 of 2 · multi-factor authentication</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{setup ? 'Set up your authenticator' : 'Enter your code'}</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.name} · {user.role}</p>
        {setup ? (
          <div className="my-6 space-y-3 text-sm text-zinc-700">
            <p>1. Open Microsoft Authenticator, Google Authenticator or any TOTP app and add an account by scanning this code.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Authenticator QR code" width={220} height={220} className="mx-auto rounded-lg ring-1 ring-zinc-200" data-mfa="qr" />
            <p className="text-xs text-zinc-500">Can’t scan? Enter this key manually (time-based): <span className="font-mono text-zinc-800" data-mfa="key">{setup.key}</span></p>
            <p>2. Type the 6-digit code the app shows.</p>
          </div>
        ) : <p className="my-6 text-sm text-zinc-700">Open your authenticator app and enter the current code for ClimaTRICs ({email}).</p>}
        <MfaForm setup={!!setup} />
      </div>
    </div>
  );
}
