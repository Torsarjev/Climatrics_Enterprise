'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { USERS, audit, createRun, ingest, recordScreening, reproduce, review, sessionUser } from '@/lib/store';
import { SESSION_COOKIE, authConfigured, checkPassword, clearFails, createSession, lockedFor, recordFail } from '@/lib/auth';
import { demoExtract } from '@/lib/portfolio';
import type { Horizon, ScenarioKey, SectorKey } from '@/lib/params';
import type { Approach } from '@/lib/engine';

export async function loginAction(_: unknown, form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!authConfigured) return { error: 'Sign-in is not configured on this server: set DEMO_PASSWORD_KEY (8+ characters).' };
  if (!email || !password) return { error: 'Enter your email and password.' };
  const locked = lockedFor(email);
  if (locked) {
    await audit('system', 'auth.login_blocked', email, `account locked, ${locked} min remaining`);
    return { error: `Too many failed attempts. Try again in ${locked} minute${locked === 1 ? '' : 's'}.` };
  }
  const account = checkPassword(email, password);
  if (!account) {
    const left = recordFail(email);
    await audit('system', 'auth.login_failed', email, 'wrong email or password');
    return { error: left > 0 ? `Wrong email or password. ${left} attempt${left === 1 ? '' : 's'} left before a 15-minute lock.` : 'Too many failed attempts. Account locked for 15 minutes.' };
  }
  clearFails(email);
  const user = USERS.find((u) => u.id === account.id)!;
  const { token, maxAge } = createSession(user.id);
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge });
  await audit(user.name, 'auth.login', user.id, `${user.role} · session 8h`);
  redirect('/');
}

export async function logoutAction() {
  const u = await sessionUser();
  if (u) await audit(u.name, 'auth.logout', u.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function ingestAction(_: unknown, form: FormData) {
  try {
    const file = form.get('file') as File | null;
    const csv = file && file.size ? await file.text() : demoExtract();
    const name = file && file.size ? file.name : 'Loan book extract · 30 Sep 2026 (synthetic)';
    await ingest(name, csv);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function runAction(_: unknown, form: FormData) {
  let id: string;
  try {
    id = await createRun({ scenario: form.get('scenario') as ScenarioKey, horizon: Number(form.get('horizon')) as Horizon, approach: form.get('approach') as Approach });
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/runs/${id}`);
}

export async function reviewAction(_: unknown, form: FormData) {
  try {
    await review(String(form.get('id')), form.get('action') as 'submit' | 'approve' | 'reject', String(form.get('note') ?? '') || undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function reproduceAction(_: unknown, form: FormData) {
  const r = await reproduce(String(form.get('id')));
  revalidatePath('/', 'layout');
  return r;
}

export async function screenAction(_: unknown, form: FormData) {
  try {
    const borrower = String(form.get('borrower') ?? '').trim();
    const amountM = Number(form.get('amount'));
    if (!borrower) return { error: 'Enter the borrower name' };
    if (!(amountM > 0)) return { error: 'Enter a loan amount above zero' };
    const id = await recordScreening({
      borrower, amountM, sector: form.get('sector') as SectorKey, region: String(form.get('region')), purpose: String(form.get('purpose') ?? ''),
      transitionPlan: form.get('plan') === 'on', exclusions: form.getAll('exclusion').map(String), flags: form.getAll('flag').map(String),
    });
    revalidatePath('/', 'layout');
    return { ok: true, id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
