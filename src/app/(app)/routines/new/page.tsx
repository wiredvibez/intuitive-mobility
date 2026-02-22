'use client';

import { useRouter } from 'next/navigation';
import { RoutineBuilder } from '@/components/routines/RoutineBuilder';

export default function NewRoutinePage() {
  const router = useRouter();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1 text-fg-muted hover:text-foreground"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">New Routine</h1>
      </div>

      <RoutineBuilder />
    </div>
  );
}
