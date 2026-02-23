'use client';

import { motion } from 'motion/react';
import type { Exercise } from '@/lib/types';

interface ExerciseCardProps {
  exercise: Exercise;
  onSelect?: (exercise: Exercise) => void;
  compact?: boolean;
}

export function ExerciseCard({ exercise, onSelect, compact = false }: ExerciseCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect?.(exercise)}
      className="flex flex-col text-left transition-colors group"
    >
      {/* Portrait preview card */}
      <div className="relative rounded-xl overflow-hidden bg-bg-card border border-border aspect-[9/16] w-full transition-colors group-hover:border-fg-subtle">
        {exercise.media_url ? (
          exercise.media_type === 'video' ? (
            <video
              src={exercise.media_url}
              muted
              loop
              playsInline
              autoPlay
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={exercise.media_url}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fg-subtle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-1 right-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white">
          {exercise.type === 'repeat' ? '⟳' : '⏱'}
        </div>
      </div>

      {/* Exercise name floating below the preview card */}
      <p className="mt-2 text-xs font-medium truncate text-foreground">{exercise.name}</p>
    </motion.button>
  );
}
