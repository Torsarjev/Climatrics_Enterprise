import { redirect } from 'next/navigation';

export default async function DisclosurePage({ searchParams }: { searchParams: Promise<{ standard?: string }> }) {
  const { standard } = await searchParams;
  redirect(`/reports?standard=${standard === 's1' ? 's1' : 's2'}`);
}
