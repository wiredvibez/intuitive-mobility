'use client';

import { formatDuration } from '@/lib/utils/formatters';

interface PlayerTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
}

export function PlayerTimer({ remainingSeconds, totalSeconds }: PlayerTimerProps) {
  const progress = totalSeconds > 0
    ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100
    : 0;

  return (
    <div className="text-center space-y-3">
      {/* Time display */}
      <p className="text-5xl font-bold tabular-nums tracking-tight">
        {formatDuration(remainingSeconds)}
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
