'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import { usePlayerStore } from '@/lib/stores/playerStore';
import {
  createArchiveEntry,
  deleteWorkout,
  updateRoutine,
  getRoutine,
  applyRoutineModifications,
} from '@/lib/firebase/firestore';
import { uploadMemoryMedia } from '@/lib/firebase/storage';
import { Button } from '@/components/ui/Button';
import { BlocksList } from './BlocksList';
import { SummaryModifications } from './SummaryModifications';
import { MemoryCapture, type CapturedMedia } from './MemoryCapture';
import { formatDuration } from '@/lib/utils/formatters';
import { Timestamp } from 'firebase/firestore';

export function WorkoutSummary() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const {
    workoutId,
    routineId,
    routineName,
    completedBlocks,
    resetPlayer,
  } = usePlayerStore();

  const [customName, setCustomName] = useState(routineName);
  const [editingName, setEditingName] = useState(false);
  const [captures, setCaptures] = useState<CapturedMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [modsSaving, setModsSaving] = useState(false);
  const [modsHandled, setModsHandled] = useState(false);

  const hasModifications = completedBlocks.some(
    (b) => b.time_added_secs > 0 || b.skipped
  );

  const totalDuration = completedBlocks.reduce(
    (sum, b) => sum + (b.skipped ? 0 : b.actual_duration_secs),
    0
  );

  const completedCount = completedBlocks.filter((b) => !b.skipped).length;
  const totalCount = completedBlocks.length;

  const handleCapture = useCallback((media: CapturedMedia) => {
    setCaptures((prev) => [...prev, media]);
  }, []);

  const handleRemoveCapture = useCallback((id: string) => {
    setCaptures((prev) => {
      const item = prev.find((c) => c.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const handleSaveModifications = async (
    mods: { blockId: string; newDuration?: number; remove?: boolean }[]
  ) => {
    if (!firebaseUser || !routineId) return;
    setModsSaving(true);
    try {
      const routine = await getRoutine(firebaseUser.uid, routineId);
      if (routine) {
        const updatedBlocks = applyRoutineModifications(routine.blocks, mods);
        await updateRoutine(firebaseUser.uid, routineId, {
          blocks: updatedBlocks,
        });
        addToast('Routine updated', 'success');
      }
    } catch (err) {
      console.error('Failed to apply modifications:', err);
      addToast('Failed to update routine', 'error');
    } finally {
      setModsSaving(false);
      setModsHandled(true);
    }
  };

  const handleDone = async () => {
    if (!firebaseUser || !workoutId || !routineId) return;
    setSaving(true);

    try {
      const allSkipped = completedCount === 0;

      // Upload memory media (only if we're saving to archive)
      const memoryMedia: { url: string; type: 'photo' | 'video' }[] = [];
      const memoryPaths: string[] = [];

      if (!allSkipped) {
        for (const capture of captures) {
          const fileName = `${capture.id}.${capture.type === 'photo' ? 'jpg' : 'webm'}`;
          const { url, path } = await uploadMemoryMedia(
            firebaseUser.uid,
            workoutId,
            capture.blob,
            fileName
          );
          memoryMedia.push({ url, type: capture.type });
          memoryPaths.push(path);
        }

        // Create archive entry only when at least one block was completed
        await createArchiveEntry(firebaseUser.uid, {
          workout_id: workoutId,
          routine_id: routineId,
          routine_name: routineName,
          custom_name: customName || routineName,
          completed_at: Timestamp.now(),
          completion_type: 'completed',
          total_duration_secs: totalDuration,
          blocks_completed: completedBlocks,
          modifications_applied: modsHandled,
          memory_media: memoryMedia,
          memory_media_paths: memoryPaths,
        });
      }

      // Clean up active workout
      await deleteWorkout(firebaseUser.uid, workoutId);

      // Reset player
      resetPlayer();

      // Clean up preview URLs
      captures.forEach((c) => URL.revokeObjectURL(c.previewUrl));

      addToast(allSkipped ? 'Workout cleared' : 'Workout saved!', 'success');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to save workout:', err);
      addToast('Failed to save workout', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-32">
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl text-success">✓</span>
        </div>
        <h1 className="text-xl font-bold">Workout Complete</h1>
      </motion.div>

      {/* Workout name */}
      <div className="mb-6">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              className="flex-1 bg-bg-elevated rounded-xl px-4 py-3 text-sm border border-accent focus:outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-2 w-full bg-bg-card rounded-xl px-4 py-3 border border-border text-left"
          >
            <span className="text-sm font-medium flex-1 truncate">
              {customName || routineName}
            </span>
            <span className="text-fg-subtle text-xs">✎</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-bg-card rounded-xl p-3 border border-border text-center">
          <p className="text-lg font-bold">{formatDuration(totalDuration)}</p>
          <p className="text-xs text-fg-muted">Duration</p>
        </div>
        <div className="flex-1 bg-bg-card rounded-xl p-3 border border-border text-center">
          <p className="text-lg font-bold">
            {completedCount}/{totalCount}
          </p>
          <p className="text-xs text-fg-muted">Blocks</p>
        </div>
      </div>

      {/* Memory capture */}
      <div className="mb-6">
        <MemoryCapture
          captures={captures}
          onCapture={handleCapture}
          onRemove={handleRemoveCapture}
        />
      </div>

      {/* Blocks list */}
      <div className="mb-6">
        <BlocksList blocks={completedBlocks} />
      </div>

      {/* Modifications */}
      {hasModifications && !modsHandled && (
        <div className="mb-6 bg-bg-card rounded-xl p-4 border border-border">
          <SummaryModifications
            completedBlocks={completedBlocks}
            onSave={handleSaveModifications}
            onKeepAsIs={() => setModsHandled(true)}
            saving={modsSaving}
          />
        </div>
      )}

      {/* Done button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-b bg-bg-card/95 backdrop-blur-md border-t border-border z-30">
        <div className="max-w-app mx-auto">
          <Button fullWidth onClick={handleDone} loading={saving}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
