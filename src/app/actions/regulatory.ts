'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createRegulatoryPack, reviewRegulatoryPack, saveDisclosureRow } from '@/lib/store';

export async function createRegulatoryAction(_: unknown, form: FormData) {
  let id: string;
  try { id = await createRegulatoryPack(form); }
  catch (error) { return { error: (error as Error).message }; }
  revalidatePath('/reports');
  redirect(`/reports?pack=${id}`);
}

export async function saveDisclosureAction(_: unknown, form: FormData) {
  const id = String(form.get('pack') ?? '');
  const row = String(form.get('requirement') ?? '');
  try { await saveDisclosureRow(id, form); }
  catch (error) { return { error: (error as Error).message }; }
  revalidatePath('/reports');
  redirect(`/reports?${new URLSearchParams({ pack: id, requirement: row })}#requirement-detail`);
}

export async function reviewRegulatoryAction(_: unknown, form: FormData) {
  let id: string;
  try { id = await reviewRegulatoryPack(String(form.get('pack') ?? ''), form); }
  catch (error) { return { error: (error as Error).message }; }
  revalidatePath('/reports');
  redirect(`/reports?pack=${id}`);
}
