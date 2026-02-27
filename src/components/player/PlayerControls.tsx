'use client';

import { motion } from 'motion/react';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  onAddTime: () => void;
}

export function PlayerControls({
  isPlaying,
  onPlayPause,
  onSkip,
  onAddTime,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      {/* +10s */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onAddTime}
        className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-fg-muted hover:text-foreground transition-colors"
      >
        <span className="text-xs font-bold">+10s</span>
      </motion.button>

      {/* Play/Pause */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onPlayPause}
        className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-accent-fg shadow-lg shadow-accent/30"
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="8,5 19,12 8,19" />
          </svg>
        )}
      </motion.button>

      {/* Skip */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onSkip}
        className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-fg-muted hover:text-foreground transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,4 15,12 5,20" />
          <rect x="17" y="4" width="3" height="16" rx="1" />
        </svg>
      </motion.button>
    </div>
  );
}
