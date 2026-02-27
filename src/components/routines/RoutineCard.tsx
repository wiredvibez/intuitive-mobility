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
      className="w-full text-left bg-bg-card rounded-2xl px-5 py-4 transition-all hover:bg-bg-elevated active:bg-bg-elevated"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-xl leading-tight truncate text-foreground">
            {routine.name}
          </h3>
          <p className="text-xs text-fg-muted mt-1">
            {formatDurationCompact(routine.total_duration_secs)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span className="font-display font-bold text-4xl leading-none text-accent">
            {exerciseCount}
          </span>
          <p className="text-[10px] text-fg-subtle mt-0.5 uppercase tracking-wide">
            {exerciseCount !== 1 ? 'moves' : 'move'}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
