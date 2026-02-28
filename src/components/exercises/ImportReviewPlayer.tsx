'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { getVideoImportJob } from '@/lib/firebase/firestore';
import { functions, httpsCallable } from '@/lib/firebase/config';
import { useUIStore } from '@/lib/stores/uiStore';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChipSelector } from './ChipSelector';
import { MediaPlayer } from '@/components/player/MediaPlayer';
import { ImportVideoTrimmer } from './ImportVideoTrimmer';
import { XIcon, ChevronIcon } from '@/components/ui/Icons';
import { EXERCISE_CHIPS, EXERCISE_TYPE_LABELS } from '@/lib/types';
import type { VideoImportJob, ImportExerciseItem } from '@/lib/types';

interface ImportReviewPlayerProps {
  job: VideoImportJob;
  onComplete: () => void;
}

interface ExerciseEditState {
  name: string;
  description: string;
  type: 'repeat' | 'timed';
  timePerRep: string;
  chips: string[];
  twoSided: boolean;
}

export function ImportReviewPlayer({ job: initialJob, onComplete }: ImportReviewPlayerProps) {
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [job, setJob] = useState<VideoImportJob>(initialJob);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editStates, setEditStates] = useState<Map<number, ExerciseEditState>>(new Map());
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [preloadedVideos, setPreloadedVideos] = useState<Set<string>>(new Set());
  const [trimmerExercise, setTrimmerExercise] = useState<ImportExerciseItem | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const pendingExercises = job.exercises.filter((e) => e.status === 'pending');
  const approvedCount = job.exercises.filter((e) => e.status === 'approved').length;
  const removedCount = job.exercises.filter((e) => e.status === 'removed').length;

  const instagramHandle = job.instagram_metadata?.author?.username
    ? `@${job.instagram_metadata.author.username}`
    : null;

  // Initialize edit states for all pending exercises
  useEffect(() => {
    const newStates = new Map<number, ExerciseEditState>();
    pendingExercises.forEach((ex) => {
      if (!editStates.has(ex.index)) {
        newStates.set(ex.index, {
          name: ex.name,
          description: ex.description,
          type: ex.type,
          timePerRep: String(ex.default_time_per_rep_secs ?? 2),
          chips: ex.chips ?? [],
          twoSided: ex.two_sided ?? false,
        });
      } else {
        newStates.set(ex.index, editStates.get(ex.index)!);
      }
    });
    setEditStates(newStates);
  }, [job.exercises]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload all videos for quick navigation
  useEffect(() => {
    pendingExercises.forEach((ex) => {
      if (ex.media_url && !preloadedVideos.has(ex.media_url)) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.src = ex.media_url;
        video.load();
        setPreloadedVideos((prev) => new Set([...Array.from(prev), ex.media_url!]));
      }
    });
  }, [pendingExercises, preloadedVideos]);

  const updateEditState = useCallback((index: number, updates: Partial<ExerciseEditState>) => {
    setEditStates((prev) => {
      const newMap = new Map(prev);
      const current = prev.get(index) || {
        name: '',
        description: '',
        type: 'repeat' as const,
        timePerRep: '2',
        chips: [],
        twoSided: false,
      };
      newMap.set(index, { ...current, ...updates });
      return newMap;
    });
  }, []);

  const handleCardClick = useCallback((index: number, isCurrentlyExpanded: boolean) => {
    if (isCurrentlyExpanded) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
      // Scroll to the card after a short delay to allow the expansion animation to start
      requestAnimationFrame(() => {
        const cardEl = cardRefs.current.get(index);
        const containerEl = scrollContainerRef.current;
        if (cardEl && containerEl) {
          const containerRect = containerEl.getBoundingClientRect();
          const cardRect = cardEl.getBoundingClientRect();
          const scrollTop = containerEl.scrollTop + (cardRect.top - containerRect.top) - 16; // 16px padding
          containerEl.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
      });
    }
  }, []);

  const handleApprove = async (exercise: ImportExerciseItem) => {
    if (!firebaseUser) return;
    const state = editStates.get(exercise.index);
    if (!state) return;

    setLoadingIndex(exercise.index);
    try {
      const approve = httpsCallable<
        { jobId: string; exerciseIndex: number; edits?: Record<string, unknown> },
        { exerciseId: string }
      >(functions, 'approveImportExerciseCallable');
      
      await approve({
        jobId: job.id,
        exerciseIndex: exercise.index,
        edits: {
          name: state.name.trim(),
          description: state.description.trim(),
          type: state.type,
          default_time_per_rep_secs: state.type === 'repeat' ? parseInt(state.timePerRep, 10) : undefined,
          chips: state.chips,
          two_sided: state.twoSided,
        },
      });
      
      addToast('Exercise added', 'success');
      const updated = await getVideoImportJob(job.id);
      if (updated) {
        setJob(updated);
        const nextPending = updated.exercises.filter((e) => e.status === 'pending');
        if (nextPending.length === 0) {
          onComplete();
        } else {
          setExpandedIndex(null);
        }
      }
    } catch (err) {
      addToast('Failed to add exercise', 'error');
    } finally {
      setLoadingIndex(null);
    }
  };

  const handleRemove = async (exercise: ImportExerciseItem) => {
    if (!firebaseUser) return;
    setLoadingIndex(exercise.index);
    
    try {
      const remove = httpsCallable<
        { jobId: string; exerciseIndex: number },
        { success: boolean }
      >(functions, 'removeImportExerciseCallable');
      
      await remove({
        jobId: job.id,
        exerciseIndex: exercise.index,
      });
      
      addToast('Removed', 'info');
      const updated = await getVideoImportJob(job.id);
      if (updated) {
        setJob(updated);
        const nextPending = updated.exercises.filter((e) => e.status === 'pending');
        if (nextPending.length === 0) {
          onComplete();
        } else {
          setExpandedIndex(null);
        }
      }
    } catch (err) {
      addToast('Failed to remove', 'error');
    } finally {
      setLoadingIndex(null);
    }
  };

  const handleApproveAll = async () => {
    for (const exercise of pendingExercises) {
      await handleApprove(exercise);
    }
  };

  if (pendingExercises.length === 0) {
    onComplete();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col pt-safe-t pb-safe-b">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={onComplete}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground"
          aria-label="Close"
        >
          <XIcon size={18} />
        </button>
        <div className="text-sm text-fg-muted text-center">
          <span className="font-medium">{pendingExercises.length}</span> to review
          {approvedCount > 0 && <span className="text-success"> · {approvedCount} added</span>}
          {removedCount > 0 && <span className="text-danger"> · {removedCount} removed</span>}
        </div>
        <div className="w-8" />
      </div>

      {/* Subheader with source info */}
      {instagramHandle && (
        <div className="flex-shrink-0 px-4 py-2 bg-bg-elevated border-b border-border">
          <p className="text-xs text-fg-muted">
            From <span className="text-accent font-medium">{instagramHandle}</span>
          </p>
        </div>
      )}

      {/* Content - Collapsible cards */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {pendingExercises.map((exercise) => {
            const isExpanded = expandedIndex === exercise.index;
            const state = editStates.get(exercise.index);
            const isLoading = loadingIndex === exercise.index;

            return (
              <div
                key={exercise.index}
                ref={(el) => {
                  if (el) cardRefs.current.set(exercise.index, el);
                  else cardRefs.current.delete(exercise.index);
                }}
                className="bg-bg-card border border-border rounded-xl overflow-hidden"
              >
                {/* Card header - clickable to expand, sticky when expanded */}
                <button
                  onClick={() => handleCardClick(exercise.index, isExpanded)}
                  className={`
                    w-full flex items-center gap-3 p-3 text-left bg-bg-card
                    ${isExpanded ? 'sticky top-0 z-10 border-b border-border' : ''}
                  `}
                  disabled={isLoading}
                >
                  {/* Video thumbnail */}
                  {exercise.media_url && (
                    <div className="w-16 h-24 rounded-lg overflow-hidden bg-bg-elevated flex-shrink-0">
                      <video
                        src={exercise.media_url}
                        muted
                        playsInline
                        loop
                        autoPlay={isExpanded}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {state?.name || exercise.name}
                    </p>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {EXERCISE_TYPE_LABELS[state?.type || exercise.type]}
                      {(state?.chips?.length || exercise.chips?.length) > 0 && (
                        <> · {(state?.chips || exercise.chips || []).slice(0, 2).join(', ')}</>
                      )}
                    </p>
                  </div>

                  <ChevronIcon
                    size={20}
                    className={`text-fg-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && state && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-3 pt-3">
                        {/* Large video preview - clickable to edit clip */}
                        {exercise.media_url && (
                          <button
                            type="button"
                            onClick={() => setTrimmerExercise(exercise)}
                            className="relative w-full max-w-[180px] mx-auto aspect-[9/16] rounded-xl overflow-hidden bg-bg-elevated group"
                          >
                            <MediaPlayer
                              mediaUrl={exercise.media_url}
                              mediaType="video"
                              className="w-full h-full"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-white/90 text-black text-xs font-semibold px-3 py-1.5 rounded-full">
                                Edit Clip
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Editable fields */}
                        <Input
                          label="Name"
                          value={state.name}
                          onChange={(e) => updateEditState(exercise.index, { name: e.target.value })}
                          placeholder="Exercise name"
                        />
                        
                        <Textarea
                          label="Description"
                          value={state.description}
                          onChange={(e) => updateEditState(exercise.index, { description: e.target.value })}
                          placeholder="Form cues, instructions..."
                        />

                        {/* Type selector */}
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-fg-muted">Type</label>
                          <div className="flex rounded-xl bg-bg-elevated border border-border overflow-hidden">
                            {(['repeat', 'timed'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => updateEditState(exercise.index, { type: t })}
                                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                  state.type === t ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-foreground'
                                }`}
                              >
                                {EXERCISE_TYPE_LABELS[t]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {state.type === 'repeat' && (
                          <Input
                            label="Seconds per rep"
                            type="number"
                            value={state.timePerRep}
                            onChange={(e) => updateEditState(exercise.index, { timePerRep: e.target.value })}
                            min={1}
                          />
                        )}

                        {/* Two-sided toggle */}
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-sm font-medium text-foreground">Two-sided</span>
                            <p className="text-xs text-fg-muted">Do both left and right sides</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateEditState(exercise.index, { twoSided: !state.twoSided })}
                            className={`
                              relative shrink-0 w-12 h-6 rounded-full transition-colors
                              ${state.twoSided ? 'bg-accent' : 'bg-bg-elevated border border-border'}
                            `}
                          >
                            <span
                              className={`
                                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                                ${state.twoSided ? 'translate-x-6' : 'translate-x-0'}
                              `}
                            />
                          </button>
                        </div>

                        {/* Tags */}
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-fg-muted">Tags</label>
                          <ChipSelector
                            selected={state.chips}
                            onChange={(chips) => updateEditState(exercise.index, { chips })}
                            chips={EXERCISE_CHIPS}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="secondary"
                            onClick={() => handleRemove(exercise)}
                            loading={isLoading}
                            className="flex-1 !py-2.5 !text-sm"
                          >
                            Remove
                          </Button>
                          <Button
                            onClick={() => handleApprove(exercise)}
                            loading={isLoading}
                            className="flex-1 !py-2.5 !text-sm"
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-bg-card/95 backdrop-blur-md">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onComplete}
            className="flex-1 !py-3"
          >
            Done for now
          </Button>
          <Button
            onClick={handleApproveAll}
            loading={loadingIndex !== null}
            className="flex-1 !py-3"
          >
            Approve All ({pendingExercises.length})
          </Button>
        </div>
      </div>

      {/* Trimmer modal */}
      {trimmerExercise && trimmerExercise.media_url && (
        <ImportVideoTrimmer
          videoUrl={trimmerExercise.media_url}
          initialStart={0}
          initialEnd={undefined}
          onTrim={async (blob, newStart, newEnd) => {
            addToast('Clip updated', 'success');
            setTrimmerExercise(null);
          }}
          onCancel={() => setTrimmerExercise(null)}
        />
      )}
    </div>
  );
}
