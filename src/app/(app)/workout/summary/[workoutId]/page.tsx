'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/uiStore';
import { WorkoutSummary } from '@/components/summary/WorkoutSummary';

export default function WorkoutSummaryPage() {
  const setHideBottomNav = useUIStore((s) => s.setHideBottomNav);

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  return <WorkoutSummary />;
}
