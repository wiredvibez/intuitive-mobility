'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import {
  formatDurationCompact,
  countExerciseBlocks,
  formatRelativeTime,
} from '@/lib/utils/formatters';
import type { Routine } from '@/lib/types';

interface RoutineCardProps {
  routine: Routine;
  onClick: () => void;
  isPinned?: boolean;
  canPin?: boolean;
  onTogglePin?: () => void;
  lastPerformed?: Date | null;
  onSwipeStart?: () => void;
}

const SWIPE_THRESHOLD = 100;

export function RoutineCard({
  routine,
  onClick,
  isPinned = false,
  canPin = true,
  onTogglePin,
  lastPerformed,
  onSwipeStart,
}: RoutineCardProps) {
  const router = useRouter();
  const exerciseCount = countExerciseBlocks(routine.blocks);
  const [isDragging, setIsDragging] = useState(false);

  const x = useMotionValue(0);
  const backgroundOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.x > SWIPE_THRESHOLD) {
      if (onSwipeStart) {
        onSwipeStart();
      } else {
        router.push(`/workout/${routine.id}`);
      }
    }
  };

  const handleClick = () => {
    if (!isDragging) {
      onClick();
    }
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePin && (canPin || isPinned)) {
      onTogglePin();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe background */}
      <motion.div
        className="absolute inset-0 bg-accent flex items-center pl-6 rounded-2xl"
        style={{ opacity: backgroundOpacity }}
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-accent-fg">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span className="font-bold text-sm">Start</span>
        </motion.div>
      </motion.div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileTap={{ scale: isDragging ? 1 : 0.98 }}
        onClick={handleClick}
        className="relative w-full text-left bg-bg-card rounded-2xl px-5 py-4 transition-colors hover:bg-bg-elevated active:bg-bg-elevated cursor-pointer"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Pin button */}
          <button
            onClick={handlePinClick}
            disabled={!canPin && !isPinned}
            className={`
              shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all
              ${isPinned
                ? 'bg-accent text-accent-fg'
                : 'bg-transparent text-fg-subtle/30 hover:text-fg-subtle'
              }
              ${!canPin && !isPinned ? 'opacity-30 cursor-not-allowed' : ''}
            `}
            aria-label={isPinned ? 'Unpin routine' : 'Pin routine'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-xl leading-tight truncate text-foreground">
              {routine.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-fg-muted">
                {formatDurationCompact(routine.total_duration_secs)}
              </span>
              {lastPerformed && (
                <>
                  <span className="text-fg-subtle text-xs">·</span>
                  <span className="text-xs text-fg-subtle">
                    {formatRelativeTime(lastPerformed)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Exercise count */}
          <div className="shrink-0 text-right">
            <span className="font-display font-bold text-4xl leading-none text-accent">
              {exerciseCount}
            </span>
            <p className="text-[10px] text-fg-subtle mt-0.5 uppercase tracking-wide">
              {exerciseCount !== 1 ? 'moves' : 'move'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
