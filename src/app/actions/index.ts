'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { USERS, mfaEnrolledAt, setMfaEnrolled, attachEvidence, audit, createRun, createScreenRun, ingest, reproduce, review, reviewScreenRun, sessionUser } from '@/lib/store';
import type { ScreenInput } from '@/lib/esg/engine';
import { ACCOUNTS, MFA_COOKIE, SESSION_COOKIE, authConfigured, checkPassword, clearFails, createMfaPending, createSession, lockedFor, mfaRequired, readMfaPending, recordFail, verifyTotp } from '@/lib/auth';
import { demoExtract } from '@/lib/portfolio';
import type { Horizon, ScenarioKey } from '@/lib/params';
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
  const user = USERS.find((u) => u.id === account.id)!;
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  if (mfaRequired) {
    const p = createMfaPending(user.id);
    (await cookies()).set(MFA_COOKIE, p.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: p.maxAge });
    await audit(user.name, 'auth.password_ok', user.id, 'awaiting authenticator code');
    redirect('/login/mfa');
  }
  clearFails(email);
  const { token, maxAge } = createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge });
  await audit(user.name, 'auth.login', user.id, `${user.role} · password only (MFA switched off) · session 8h`);
  redirect('/');
}

export async function mfaAction(_: unknown, form: FormData) {
  const jar = await cookies();
  const id = readMfaPending(jar.get(MFA_COOKIE)?.value);
  if (!id) return { error: 'Your sign-in expired. Start again with your email and password.', restart: true };
  const user = USERS.find((u) => u.id === id)!;
  const email = ACCOUNTS.find((a) => a.id === id)!.email;
  const locked = lockedFor(email);
  if (locked) {
    await audit('system', 'auth.login_blocked', email, `account locked, ${locked} min remaining`);
    return { error: `Too many failed attempts. Try again in ${locked} minute${locked === 1 ? '' : 's'}.`, restart: true };
  }
  if (!verifyTotp(id, String(form.get('code') ?? ''))) {
    const left = recordFail(email);
    await audit('system', 'auth.mfa_failed', email, 'wrong or reused authenticator code');
    return { error: left > 0 ? `That code is not valid. ${left} attempt${left === 1 ? '' : 's'} left before a 15-minute lock.` : 'Too many failed attempts. Account locked for 15 minutes.', restart: left <= 0 };
  }
  clearFails(email);
  if (!(await mfaEnrolledAt(id))) { await setMfaEnrolled(id); await audit(user.name, 'auth.mfa_enrolled', user.id, 'authenticator app registered'); }
  jar.delete(MFA_COOKIE);
  const { token, maxAge } = createSession(user.id);
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge });
  await audit(user.name, 'auth.login', user.id, `${user.role} · password + authenticator code · session 8h`);
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

export async function screenRunAction(_: unknown, form: FormData) {
  let id: string;
  try {
    const input = JSON.parse(String(form.get('payload'))) as ScreenInput;
    id = await createScreenRun(input);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/screening/${id}`);
}

export async function evidenceAction(_: unknown, form: FormData) {
  let id: string;
  try {
    id = await attachEvidence(String(form.get('id')), String(form.get('evidence')), String(form.get('ref') ?? '').trim() || 'synthetic-document.pdf');
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/screening/${id}`);
}

export async function screenReviewAction(_: unknown, form: FormData) {
  try {
    await reviewScreenRun(String(form.get('id')), form.get('action') as 'submit' | 'approve' | 'escalate' | 'return', String(form.get('note') ?? '') || undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
