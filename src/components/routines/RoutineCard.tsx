'use client';

import { motion } from 'motion/react';
import { formatDurationCompact, countExerciseBlocks } from '@/lib/utils/formatters';
import type { Routine } from '@/lib/types';

interface RoutineCardProps {
  routine: Routine;
  onClick: () => void;
}

export function RoutineCard({ routine, onClick }: RoutineCardProps) {
  const exerciseCount = countExerciseBlocks(routine.blocks);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left bg-bg-card border border-border rounded-xl p-4 transition-colors hover:border-fg-subtle"
    >
      <h3 className="font-semibold text-sm mb-1.5 truncate">
        {routine.name}
      </h3>
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
        <span className="text-fg-subtle">·</span>
        <span>{formatDurationCompact(routine.total_duration_secs)}</span>
      </div>
    </motion.button>
  );
}
