'use client';

import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-app mx-auto pt-safe-t pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
