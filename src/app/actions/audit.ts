'use server';

import { revalidatePath } from 'next/cache';
import { recordAuditReview } from '@/lib/store';

export async function auditReviewAction(_: unknown, form: FormData) {
  const text = (k: string) => String(form.get(k) ?? '');
  try {
    await recordAuditReview(text('kind'), text('target'), text('opinion'), text('findings'), text('reference'));
  } catch (e) {
    return { error: (e as Error).message, values: { opinion: text('opinion'), findings: text('findings'), reference: text('reference') } };
  }
  revalidatePath('/internal-audit');
  return { ok: true };
}
