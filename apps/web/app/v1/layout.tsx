import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function V1Layout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
