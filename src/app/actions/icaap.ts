'use server';

import { redirect } from 'next/navigation';
import { createIcaap, reviewIcaap } from '@/lib/store';

export async function projectIcaapAction(_: unknown, form: FormData) {
  let id: string;
  try {
    id = await createIcaap(form);
  } catch (error) {
    return { error: (error as Error).message };
  }
  redirect(`/capital?assessment=${id}`);
}

export async function reviewIcaapAction(_: unknown, form: FormData) {
  const id = String(form.get('id') ?? '');
  try {
    await reviewIcaap(id, String(form.get('action') ?? ''), String(form.get('note') ?? '').trim());
  } catch (error) {
    return { error: (error as Error).message };
  }
  redirect(`/capital?assessment=${id}`);
}
