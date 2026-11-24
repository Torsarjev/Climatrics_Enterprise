import { reviewScreenRun, sessionUser } from '@/lib/store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  try {
    const { action, note } = (await req.json()) as { action: 'submit' | 'approve' | 'escalate' | 'return'; note?: string };
    await reviewScreenRun((await params).id, action, note);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
