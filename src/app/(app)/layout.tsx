'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { MobileShell } from '@/components/layout/MobileShell';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <MobileShell>{children}</MobileShell>
    </AuthGuard>
  );
}
