'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getVideoImportJob, updateVideoImportJob } from '@/lib/firebase/firestore';
import { functions, httpsCallable } from '@/lib/firebase/config';
import { useUIStore } from '@/lib/stores/uiStore';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChipSelector } from './ChipSelector';
import { MediaPlayer } from '@/components/player/MediaPlayer';
import { XIcon } from '@/components/ui/Icons';
import { EXERCISE_CHIPS, EXERCISE_TYPE_LABELS } from '@/lib/types';
import type { VideoImportJob } from '@/lib/types';

interface ImportReviewPlayerProps {
  job: VideoImportJob;
  onComplete: () => void;
}

export function ImportReviewPlayer({ job: initialJob, onComplete }: ImportReviewPlayerProps) {
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [job, setJob] = useState<VideoImportJob>(initialJob);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'repeat' | 'timed'>('repeat');
  const [timePerRep, setTimePerRep] = useState('2');
  const [chips, setChips] = useState<string[]>([]);
  const [twoSided, setTwoSided] = useState(false);
  const [loading, setLoading] = useState(false);

  const pendingExercises = job.exercises.filter((e) => e.status === 'pending');
  const currentExercise = pendingExercises[currentIndex];
  const totalPending = pendingExercises.length;
  const isLast = currentIndex >= totalPending - 1;

  useEffect(() => {
    if (currentExercise) {
      setName(currentExercise.name);
      setDescription(currentExercise.description);
      setType(currentExercise.type);
      setTimePerRep(
        String(currentExercise.default_time_per_rep_secs ?? 2)
      );
      setChips(currentExercise.chips ?? []);
      setTwoSided(currentExercise.two_sided ?? false);
    }
  }, [currentExercise]);

  const handleApprove = async () => {
    if (!currentExercise || !firebaseUser) return;
    setLoading(true);
    try {
      const approve = httpsCallable<
        { jobId: string; exerciseIndex: number; edits?: Record<string, unknown> },
        { exerciseId: string }
      >(functions, 'approveImportExerciseCallable');
      await approve({
        jobId: job.id,
        exerciseIndex: currentExercise.index,
        edits: {
          name: name.trim(),
          description: description.trim(),
          type,
          default_time_per_rep_secs: type === 'repeat' ? parseInt(timePerRep, 10) : undefined,
          chips,
          two_sided: twoSided,
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
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      addToast('Failed to add exercise', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentExercise || !firebaseUser) return;
    setLoading(true);
    try {
      const remove = httpsCallable<
        { jobId: string; exerciseIndex: number },
        { success: boolean }
      >(functions, 'removeImportExerciseCallable');
      await remove({
        jobId: job.id,
        exerciseIndex: currentExercise.index,
      });
      addToast('Removed', 'info');
      const updated = await getVideoImportJob(job.id);
      if (updated) {
        setJob(updated);
        const nextPending = updated.exercises.filter((e) => e.status === 'pending');
        if (nextPending.length === 0) {
          onComplete();
        } else {
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      addToast('Failed to remove', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (!currentExercise) {
    onComplete();
    return null;
  }

  const approvedCount = job.exercises.filter((e) => e.status === 'approved').length;
  const removedCount = job.exercises.filter((e) => e.status === 'removed').length;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={onComplete}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground"
          aria-label="Close"
        >
          <XIcon size={18} />
        </button>
        <div className="text-sm text-fg-muted">
          {currentIndex + 1} of {totalPending} · {approvedCount} added, {removedCount} removed
        </div>
        <button
          onClick={handleSkip}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-foreground text-xs"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Video */}
          {currentExercise.media_url && (
            <div className="w-full max-w-[200px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-bg-elevated">
              <MediaPlayer
                mediaUrl={currentExercise.media_url}
                mediaType="video"
                className="w-full h-full"
              />
            </div>
          )}

          {/* Editable fields */}
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exercise name"
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Form cues, instructions..."
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-fg-muted">Type</label>
            <div className="flex rounded-xl bg-bg-elevated border border-border overflow-hidden">
              {(['repeat', 'timed'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    type === t ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-foreground'
                  }`}
                >
                  {EXERCISE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {type === 'repeat' && (
            <Input
              label="Seconds per rep"
              type="number"
              value={timePerRep}
              onChange={(e) => setTimePerRep(e.target.value)}
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
              onClick={() => setTwoSided(!twoSided)}
              className={`
                relative shrink-0 w-12 h-6 rounded-full transition-colors overflow-visible
                ${twoSided ? 'bg-accent' : 'bg-bg-elevated border border-border'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${twoSided ? 'translate-x-6' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-fg-muted">Tags</label>
            <ChipSelector
              selected={chips}
              onChange={setChips}
              chips={EXERCISE_CHIPS}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border flex gap-3">
        <Button
          variant="secondary"
          onClick={handleRemove}
          loading={loading}
          className="flex-1 !py-3"
        >
          Remove
        </Button>
        <Button
          onClick={handleApprove}
          loading={loading}
          className="flex-1 !py-3"
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
