'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import type { CachedRoutine } from '@/lib/db/dexie';
import { formatBytes } from '@/lib/hooks/useOfflineCache';

interface SwipeableRoutineItemProps {
  routine: CachedRoutine;
  onRemove: () => void;
}

const SWIPE_THRESHOLD = 60;
const DELETE_BUTTON_WIDTH = 72;

export function SwipeableRoutineItem({
  routine,
  onRemove,
}: SwipeableRoutineItemProps) {
  const [revealed, setRevealed] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-DELETE_BUTTON_WIDTH, 0], [1, 0]);
  const deleteScale = useTransform(x, [-DELETE_BUTTON_WIDTH, 0], [1, 0.8]);

  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX < -SWIPE_THRESHOLD) {
      animate(x, -DELETE_BUTTON_WIDTH, { type: 'spring', stiffness: 300, damping: 30 });
      setRevealed(true);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      setRevealed(false);
    }
  };

  const handleTap = () => {
    if (revealed) {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      setRevealed(false);
    } else {
      animate(x, -DELETE_BUTTON_WIDTH, { type: 'spring', stiffness: 300, damping: 30 });
      setRevealed(true);
    }
  };

  const handleDelete = () => {
    onRemove();
  };

  const formatExpiry = () => {
    if (routine.pinned) return null;
    if (!routine.expiresAt) return null;
    const daysLeft = Math.ceil((routine.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return 'Expiring soon';
    if (daysLeft === 1) return '1 day left';
    return `${daysLeft} days left`;
  };

  const expiry = formatExpiry();

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <motion.button
        onClick={handleDelete}
        style={{ opacity: deleteOpacity, scale: deleteScale }}
        className="absolute right-0 top-0 bottom-0 w-[72px] bg-red-500 flex items-center justify-center"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </motion.button>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_BUTTON_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        style={{ x }}
        className="relative bg-bg-card border border-border rounded-xl p-4 cursor-pointer touch-pan-y"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{routine.routine.name}</p>
              {routine.pinned && (
                <span className="shrink-0 text-accent">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="0"
                  >
                    <path d="M12 2C9.243 2 7 4.243 7 7v2H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1V7c0-2.757-2.243-5-5-5zm0 2c1.654 0 3 1.346 3 3v2H9V7c0-1.654 1.346-3 3-3zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <span>{routine.exerciseIds.length} exercises</span>
              <span>·</span>
              <span>{formatBytes(routine.sizeBytes)}</span>
              {expiry && (
                <>
                  <span>·</span>
                  <span>{expiry}</span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 text-fg-subtle ml-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
