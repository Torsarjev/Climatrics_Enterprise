'use client';

import { ErrorView } from '@/components/error-view';

export default function AuthError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
