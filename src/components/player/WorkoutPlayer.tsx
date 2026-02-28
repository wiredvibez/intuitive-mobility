'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { usePlayerStore } from '@/lib/stores/playerStore';
import { useUIStore } from '@/lib/stores/uiStore';
import { useAuth } from '@/providers/AuthProvider';
import { updateWorkoutState, deleteWorkout } from '@/lib/firebase/firestore';
import { MediaPlayer } from './MediaPlayer';
import { PlayerTimer } from './PlayerTimer';
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
    resetPlayer,
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
    setShowExitConfirm(false);
    router.push('/dashboard');
  };

  const handleDiscard = async () => {
    if (!firebaseUser || !workoutId) return;
    pause();
    await deleteWorkout(firebaseUser.uid, workoutId);
    resetPlayer();
    setHideBottomNav(false);
    setShowExitConfirm(false);
    addToast('Workout discarded', 'info');
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

  const handleAddTime = (seconds: number) => {
    addTime(seconds);
    addToast(`+${seconds}s added`, 'info');
  };

  if (!currentBlock && !isComplete) {
    return null;
  }

  const sideLabel = currentBlock?.side === 'right' ? 'Right Side' : currentBlock?.side === 'left' ? 'Left Side' : null;
  const blockLabel =
    currentBlock?.type === 'exercise'
      ? currentBlock.exercise_name
      : currentBlock?.type === 'break'
        ? 'Rest'
        : currentBlock?.type === 'prep'
          ? 'Get Ready'
          : 'Cooldown';

  // Calculate remaining reps for repeat-type exercises
  const isRepeatExercise = currentBlock?.type === 'exercise' && currentBlock.exercise_type === 'repeat';
  const totalReps = currentBlock?.reps || 0;
  const totalDuration = currentBlock?.duration_secs || 0;
  const timePerRep = totalReps > 0 && totalDuration > 0 ? totalDuration / totalReps : 0;
  const remainingReps = isRepeatExercise && timePerRep > 0
    ? Math.ceil(remainingSeconds / timePerRep)
    : 0;

  const hasVideo = currentBlock?.type === 'exercise' && currentBlock.media_url;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col pt-safe-t">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground"
          aria-label="Exit workout"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="font-medium">
            {Math.min(currentBlockIndex + 1, totalBlocks)} of {totalBlocks}
          </span>
        </div>
        <div className="w-8" />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Video area with side controls */}
        <div className="flex-1 flex items-center justify-center px-4 gap-3">
          {/* Left spacer for balance */}
          <div className="w-12 shrink-0" />

          {/* Video / Icon in center */}
          <div className="flex flex-col items-center gap-4 flex-1">
            {hasVideo ? (
              <button
                onClick={handlePlayPause}
                className="relative w-full max-w-[180px] aspect-[9/16] rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <MediaPlayer
                  mediaUrl={currentBlock.media_url}
                  mediaType={currentBlock.media_type}
                  isPlaying={isPlaying}
                  showPlayOverlay
                  className="w-full h-full"
                />
                {/* Reps overlay for repeat exercises */}
                {isRepeatExercise && remainingReps > 0 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-white tabular-nums">
                      {remainingReps}
                    </span>
                    <span className="text-xs text-white/70">
                      rep{remainingReps !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </button>
            ) : (
              <button
                onClick={handlePlayPause}
                className="w-28 h-28 rounded-full bg-bg-elevated flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {currentBlock?.type === 'break' ? (
                  <span className="text-4xl font-bold text-accent">REST</span>
                ) : currentBlock?.type === 'prep' ? (
                  <span className="text-3xl">🏃</span>
                ) : (
                  <span className="text-3xl">🧘</span>
                )}
              </button>
            )}

            {/* Block name */}
            <div className="text-center">
              <h2 className="text-lg font-bold">{blockLabel}</h2>
              {sideLabel && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent/15 text-accent">
                  {sideLabel}
                </span>
              )}
            </div>
          </div>

          {/* Right side controls: Skip + Time buttons */}
          <div className="flex flex-col items-center gap-2 w-12 shrink-0">
            {/* Skip button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSkip}
              className="w-11 h-11 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-fg-muted hover:text-foreground transition-colors"
              aria-label="Skip"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,4 15,12 5,20" />
                <rect x="17" y="4" width="3" height="16" rx="1" />
              </svg>
            </motion.button>

            {/* +10s button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAddTime(10)}
              className="w-11 h-11 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-fg-muted hover:text-foreground transition-colors"
              aria-label="Add 10 seconds"
            >
              <span className="text-[10px] font-bold">+10s</span>
            </motion.button>

            {/* +30s button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAddTime(30)}
              className="w-11 h-11 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-fg-muted hover:text-foreground transition-colors"
              aria-label="Add 30 seconds"
            >
              <span className="text-[10px] font-bold">+30s</span>
            </motion.button>
          </div>
        </div>

        {/* Timer + Play/Pause */}
        <div className="flex flex-col items-center gap-4 py-4">
          <PlayerTimer
            remainingSeconds={remainingSeconds}
            totalSeconds={currentBlock?.duration_secs || 0}
          />

          {/* Play/Pause button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-accent-fg shadow-lg shadow-accent/30"
            aria-label={isPlaying ? 'Pause' : 'Play'}
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
        </div>
      </div>

      {/* Up Next - larger section */}
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
              Save and resume later, or discard this workout.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-bg-elevated text-sm font-medium"
                >
                  Stay
                </button>
                <button
                  onClick={handleExit}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-medium"
                >
                  Save & Leave
                </button>
              </div>
              <button
                onClick={handleDiscard}
                className="w-full py-3 rounded-xl border border-danger/50 text-danger text-sm font-medium hover:bg-danger/10"
              >
                Discard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
