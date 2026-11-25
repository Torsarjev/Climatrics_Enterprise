'use server';

import { redirect } from 'next/navigation';
import { createIlaap, reviewIlaap } from '@/lib/store';

export async function projectIlaapAction(_: unknown, form: FormData) {
  let id: string;
  try { id = await createIlaap(form); }
  catch (error) { return { error: (error as Error).message }; }
  redirect(`/liquidity?assessment=${id}`);
}

export async function reviewIlaapAction(_: unknown, form: FormData) {
  const id = String(form.get('id') ?? '');
  try {
    await reviewIlaap(id, String(form.get('decision') ?? ''), String(form.get('note') ?? '').trim(), String(form.get('reference') ?? '').trim());
  } catch (error) { return { error: (error as Error).message }; }
  redirect(`/liquidity?assessment=${id}`);
}
