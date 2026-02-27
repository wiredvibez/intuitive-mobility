'use client';

import { AdminGuard } from '@/components/auth/AdminGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 w-full max-w-app mx-auto">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
