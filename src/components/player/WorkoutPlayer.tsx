'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { usePlayerStore } from '@/lib/stores/playerStore';
import { useUIStore } from '@/lib/stores/uiStore';
import { useAuth } from '@/providers/AuthProvider';
import { updateWorkoutState } from '@/lib/firebase/firestore';
import { MediaPlayer } from './MediaPlayer';
import { PlayerTimer } from './PlayerTimer';
import { PlayerControls } from './PlayerControls';
import { UpNextQueue } from './UpNextQueue';

export function WorkoutPlayer() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const setHideBottomNav = useUIStore((s) => s.setHideBottomNav);
  const addToast = useUIStore((s) => s.addToast);

  const {
    blocks,
    currentBlockIndex,
    remainingSeconds,
    isPlaying,
    workoutId,
    modifications,
    skippedBlocks,
    play,
    pause,
    skip,
    addTime,
    tick,
    getCurrentBlock,
    getNextBlocks,
  } = usePlayerStore();

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const currentBlock = getCurrentBlock();
  const nextBlocks = getNextBlocks(5);
  const totalBlocks = blocks.length;
  const isComplete = currentBlockIndex >= totalBlocks;

  // Hide bottom nav while player is active
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Navigate to summary when workout completes
  useEffect(() => {
    if (isComplete && workoutId) {
      router.push(`/workout/summary/${workoutId}`);
    }
  }, [isComplete, workoutId, router]);

  // Timer tick
  useEffect(() => {
    if (isPlaying) {
      tickRef.current = setInterval(() => {
        const complete = tick();
        if (complete) {
          // Workout finished
        }
      }, 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isPlaying, tick]);

  // Periodic state save (every 30s)
  const saveState = useCallback(async () => {
    if (!firebaseUser || !workoutId) return;
    try {
      await updateWorkoutState(firebaseUser.uid, workoutId, {
        state: isPlaying ? 'active' : 'paused',
        progress_index: currentBlockIndex,
        current_block_remaining_secs: remainingSeconds,
        modifications,
        skipped_blocks: skippedBlocks,
      });
    } catch (err) {
      console.error('Failed to save workout state:', err);
    }
  }, [firebaseUser, workoutId, isPlaying, currentBlockIndex, remainingSeconds, modifications, skippedBlocks]);

  useEffect(() => {
    saveTimerRef.current = setInterval(saveState, 30000);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [saveState]);

  // Save on block transitions
  useEffect(() => {
    saveState();
  }, [currentBlockIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = async () => {
    pause();
    await saveState();
    setHideBottomNav(false);
    router.push('/dashboard');
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleSkip = () => {
    skip();
  };

  const handleAddTime = () => {
    addTime(10);
    addToast('+10s added', 'info');
  };

  if (!currentBlock && !isComplete) {
    return null;
  }

  const blockLabel =
    currentBlock?.type === 'exercise'
      ? currentBlock.exercise_name
      : currentBlock?.type === 'break'
        ? 'Rest'
        : currentBlock?.type === 'prep'
          ? 'Get Ready'
          : 'Cooldown';

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground"
        >
          ✕
        </button>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="font-medium">
            {Math.min(currentBlockIndex + 1, totalBlocks)} of {totalBlocks}
          </span>
        </div>
        <button
          onClick={handleSkip}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,4 15,12 5,20" />
            <rect x="17" y="4" width="3" height="16" rx="1" />
          </svg>
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {currentBlock?.type === 'exercise' && currentBlock.media_url ? (
          <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden">
            <MediaPlayer
              mediaUrl={currentBlock.media_url}
              mediaType={currentBlock.media_type}
              className="w-full h-full"
            />
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-bg-elevated flex items-center justify-center">
            {currentBlock?.type === 'break' ? (
              <span className="text-4xl">☕</span>
            ) : currentBlock?.type === 'prep' ? (
              <span className="text-4xl">🏃</span>
            ) : (
              <span className="text-4xl">🧘</span>
            )}
          </div>
        )}

        {/* Block name */}
        <h2 className="text-xl font-bold text-center">{blockLabel}</h2>

        {/* Description for exercise blocks */}
        {currentBlock?.type === 'exercise' && currentBlock.exercise_description && (
          <p className="text-xs text-fg-muted text-center max-w-xs line-clamp-2">
            {currentBlock.exercise_description}
          </p>
        )}

        {/* Timer */}
        <PlayerTimer
          remainingSeconds={remainingSeconds}
          totalSeconds={currentBlock?.duration_secs || 0}
        />

        {/* Controls */}
        <PlayerControls
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onAddTime={handleAddTime}
        />
      </div>

      {/* Up Next */}
      <div className="px-4 pb-6 pb-safe-b">
        <UpNextQueue blocks={nextBlocks} />
      </div>

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-bg-card rounded-2xl p-6 w-full max-w-sm space-y-4"
          >
            <h3 className="text-lg font-semibold text-center">Leave workout?</h3>
            <p className="text-sm text-fg-muted text-center">
              Your progress will be saved and you can resume later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-bg-elevated text-sm font-medium"
              >
                Stay
              </button>
              <button
                onClick={handleExit}
                className="flex-1 py-3 rounded-xl bg-danger text-white text-sm font-medium"
              >
                Leave
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
