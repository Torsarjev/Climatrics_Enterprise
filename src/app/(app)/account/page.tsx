import { ACCOUNTS, mfaRequired } from '@/lib/auth';
import { currentUser, logView, mfaEnrolledAt } from '@/lib/store';
import { authenticatorSetup } from '@/lib/qr';
import { Card, PageHead, Table } from '@/components/ui';
import { when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await currentUser();
  const email = ACCOUNTS.find((a) => a.id === user.id)!.email;
  const enrolled = await mfaEnrolledAt(user.id);
  const show = (await searchParams).show === '1';
  const setup = show ? await authenticatorSetup(user.id, email) : null;
  if (show) await logView('auth.mfa_key_viewed', user.id, 'authenticator QR shown to add a device');

  return (
    <>
      <PageHead area="Account" title="Your account and sign-in" intro="Multi-factor authentication protects every account: a password plus a time-based code from an authenticator app." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <Table head={['', '']} rows={[
            ['Name', user.name], ['Email', email], ['Role', user.role],
            ['Multi-factor authentication', mfaRequired ? (enrolled ? `On · authenticator registered ${when(enrolled)}` : 'On · not yet registered') : 'Switched off on this server'],
            ['Session', '8 hours, signed cookie; sign out ends it'],
          ]} />
        </Card>
        <Card title="Add another device">
          {setup ? (
            <div className="space-y-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="Authenticator QR code" width={200} height={200} className="rounded-lg ring-1 ring-zinc-200" />
              <p className="text-xs text-zinc-500">Manual key: <span className="font-mono text-zinc-800">{setup.key}</span></p>
              <p className="text-xs text-zinc-500">Showing this code was recorded in the audit trail. Close the page once the device is added.</p>
            </div>
          ) : (
            <div className="text-sm text-zinc-700">
              <p>Show the setup QR code again to add this account to a second phone.</p>
              <a href="/account?show=1" className="mt-3 inline-block rounded-md bg-[#1b2c3e] px-3 py-1.5 text-sm text-white" data-action="show-mfa">Show setup code</a>
            </div>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs text-zinc-500">In production, sign-in and MFA move to GCB’s identity provider (SSO), so the bank’s own MFA policy applies and ClimaTRICs stores no passwords.</p>
    </>
  );
}
