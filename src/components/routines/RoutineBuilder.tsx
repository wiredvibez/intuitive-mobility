'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Reorder, AnimatePresence } from 'motion/react';
import { v4 as uuid } from 'uuid';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import { createRoutine, updateRoutine } from '@/lib/firebase/firestore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ExercisePicker } from '@/components/exercises/ExercisePicker';
import { RoutineBlockCard } from './RoutineBlockCard';
import { LoopBlockComponent } from './LoopBlock';
import { BlockConfigInline } from './BlockConfigInline';
import {
  formatDuration,
  calculateRoutineDuration,
} from '@/lib/utils/formatters';
import { validateRoutineName } from '@/lib/utils/validators';
import { getExerciseMediaUrl } from '@/lib/firebase/storage';
import { DURATION_PRESETS } from '@/lib/types';
import type {
  Routine,
  RoutineBlock,
  ExerciseBlock,
  BreakBlock,
  LoopBlock,
  Exercise,
} from '@/lib/types';

interface RoutineBuilderProps {
  routine?: Routine;
}

export function RoutineBuilder({ routine }: RoutineBuilderProps) {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);

  const [name, setName] = useState(routine?.name || '');
  const [blocks, setBlocks] = useState<RoutineBlock[]>(routine?.blocks || []);
  const [prepTime, setPrepTime] = useState(routine?.prep_time_secs ?? 15);
  const [cooldownTime, setCooldownTime] = useState(routine?.cooldown_time_secs ?? 15);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  // Exercise picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [insertLoopId, setInsertLoopId] = useState<string | null>(null);

  // Inline config for newly added exercise
  const [pendingExercise, setPendingExercise] = useState<{
    exercise: Exercise;
    targetIndex: number | null;
    loopId: string | null;
  } | null>(null);

  // Track exercise data for editing
  const exerciseDataMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    const collect = (blks: RoutineBlock[]) => {
      for (const b of blks) {
        if (b.type === 'exercise') {
          map.set(b.exercise_id, {
            id: b.exercise_id,
            name: b.exercise_name,
            description: b.exercise_description,
            type: b.exercise_type,
            default_time_per_rep_secs:
              b.exercise_type === 'repeat' && b.reps && b.duration_secs
                ? Math.round(b.duration_secs / b.reps)
                : 2,
            media_url: b.media_url,
            media_type: b.media_type,
          } as Exercise);
        } else if (b.type === 'loop') {
          collect(b.blocks);
        }
      }
    };
    collect(blocks);
    return map;
  }, [blocks]);

  const totalDuration = useMemo(
    () => calculateRoutineDuration(blocks, prepTime, cooldownTime),
    [blocks, prepTime, cooldownTime]
  );

  const openPicker = useCallback(
    (afterIndex?: number, loopId?: string) => {
      setInsertIndex(afterIndex ?? null);
      setInsertLoopId(loopId ?? null);
      setPickerOpen(true);
    },
    []
  );

  const handleExerciseSelected = (exercise: Exercise) => {
    setPendingExercise({
      exercise,
      targetIndex: insertIndex,
      loopId: insertLoopId,
    });
  };

  const handleExerciseConfirmed = async (config: { reps?: number; duration_secs: number }) => {
    if (!pendingExercise) return;
    const { exercise, targetIndex, loopId } = pendingExercise;

    const mediaUrl = await getExerciseMediaUrl(exercise);

    // Create blocks - two for two-sided exercises (right first, then left)
    const blocksToAdd: ExerciseBlock[] = [];

    if (exercise.two_sided) {
      // Add right side first
      blocksToAdd.push({
        id: uuid(),
        type: 'exercise',
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_description: exercise.description,
        media_url: mediaUrl,
        media_type: exercise.media_type,
        exercise_type: exercise.type,
        duration_secs: config.duration_secs,
        reps: config.reps,
        side: 'right',
      });
      // Add left side second
      blocksToAdd.push({
        id: uuid(),
        type: 'exercise',
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_description: exercise.description,
        media_url: mediaUrl,
        media_type: exercise.media_type,
        exercise_type: exercise.type,
        duration_secs: config.duration_secs,
        reps: config.reps,
        side: 'left',
      });
    } else {
      blocksToAdd.push({
        id: uuid(),
        type: 'exercise',
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_description: exercise.description,
        media_url: mediaUrl,
        media_type: exercise.media_type,
        exercise_type: exercise.type,
        duration_secs: config.duration_secs,
        reps: config.reps,
      });
    }

    if (loopId) {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.type === 'loop' && b.id === loopId) {
            const newBlocks = [...b.blocks];
            const idx = targetIndex != null ? targetIndex + 1 : newBlocks.length;
            newBlocks.splice(idx, 0, ...blocksToAdd);
            return { ...b, blocks: newBlocks };
          }
          return b;
        })
      );
    } else {
      setBlocks((prev) => {
        const newBlocks = [...prev];
        const idx = targetIndex != null ? targetIndex + 1 : newBlocks.length;
        newBlocks.splice(idx, 0, ...blocksToAdd);
        return newBlocks;
      });
    }

    // Store exercise data for future editing
    exerciseDataMap.set(exercise.id, exercise);
    setPendingExercise(null);
  };

  const addBreak = () => {
    setBlocks((prev) => [
      ...prev,
      { id: uuid(), type: 'break' as const, duration_secs: 15 },
    ]);
  };

  const addLoop = () => {
    setBlocks((prev) => [
      ...prev,
      { id: uuid(), type: 'loop' as const, iterations: 2, blocks: [] },
    ]);
  };

  const updateBlock = (index: number, block: RoutineBlock) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? block : b)));
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const err = validateRoutineName(name);
    if (err) {
      setNameError(err);
      return;
    }
    if (!firebaseUser) return;
    setSaving(true);

    try {
      const data = {
        name: name.trim(),
        blocks,
        prep_time_secs: prepTime,
        cooldown_time_secs: cooldownTime,
        total_duration_secs: totalDuration,
      };

      if (routine) {
        await updateRoutine(firebaseUser.uid, routine.id, data);
        addToast('Routine updated', 'success');
      } else {
        await createRoutine(firebaseUser.uid, data);
        addToast('Routine created', 'success');
      }
      router.push('/dashboard');
    } catch (err) {
      console.error('Save failed:', err);
      addToast('Failed to save routine', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Only allow Reorder on top-level non-loop blocks
  const topLevelBlocks = blocks;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Content */}
      <div className="flex-1 p-4 pb-48 space-y-4">
        {/* Name */}
        <Input
          placeholder="Routine name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError('');
          }}
          error={nameError}
          className="!text-lg !font-semibold !bg-transparent !border-0 !px-0 !ring-0 focus:!ring-0"
        />

        {/* Prep time */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <span className="text-sm text-fg-muted font-medium">PREP</span>
          <select
            value={prepTime}
            onChange={(e) => setPrepTime(parseInt(e.target.value))}
            className="bg-bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-foreground"
          >
            {DURATION_PRESETS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'None' : `${d}s`}
              </option>
            ))}
          </select>
        </div>

        {/* Empty state — shown between prep and cooldown when no blocks */}
        {blocks.length === 0 && (
          <button
            onClick={() => openPicker()}
            className="w-full py-10 flex flex-col items-center gap-2 border border-dashed border-border hover:border-accent/50 rounded-2xl transition-colors group"
          >
            <span className="text-2xl font-display font-bold text-fg-subtle group-hover:text-accent transition-colors">+</span>
            <span className="text-sm text-fg-muted group-hover:text-accent transition-colors">Add an exercise</span>
          </button>
        )}

        {/* Block list */}
        <Reorder.Group
          axis="y"
          values={topLevelBlocks}
          onReorder={setBlocks}
          className="space-y-0"
        >
          {topLevelBlocks.map((block, index) => {
            if (block.type === 'loop') {
              return (
                <Reorder.Item key={block.id} value={block} dragListener={false}>
                  <LoopBlockComponent
                    loop={block as LoopBlock}
                    onUpdate={(updated) => updateBlock(index, updated)}
                    onRemove={() => removeBlock(index)}
                    onAddExercise={(afterIdx) => openPicker(afterIdx, block.id)}
                    exerciseDataMap={exerciseDataMap}
                  />
                </Reorder.Item>
              );
            }

            return (
              <RoutineBlockCard
                key={block.id}
                block={block as ExerciseBlock | BreakBlock}
                onUpdate={(updated) => updateBlock(index, updated)}
                onRemove={() => removeBlock(index)}
                onAddBelow={() => openPicker(index)}
                onAddBefore={
                  block.type === 'break' ? () => openPicker(index - 1) : undefined
                }
                exerciseData={
                  block.type === 'exercise'
                    ? exerciseDataMap.get((block as ExerciseBlock).exercise_id)
                    : undefined
                }
              />
            );
          })}
        </Reorder.Group>

        {/* Pending exercise inline config */}
        <AnimatePresence>
          {pendingExercise && (
            <div className="bg-bg-card border border-accent rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className="text-xs">🎬</span>
                <span className="text-sm font-medium">
                  {pendingExercise.exercise.name}
                </span>
              </div>
              <BlockConfigInline
                exercise={pendingExercise.exercise}
                onConfirm={handleExerciseConfirmed}
                onRemove={() => setPendingExercise(null)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Cooldown time */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <span className="text-sm text-fg-muted font-medium">COOLDOWN</span>
          <select
            value={cooldownTime}
            onChange={(e) => setCooldownTime(parseInt(e.target.value))}
            className="bg-bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-foreground"
          >
            {DURATION_PRESETS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'None' : `${d}s`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom bar - positioned above BottomNav (h-14) */}
      <div className="fixed left-0 right-0 bg-bg-card/95 backdrop-blur-md border-t border-border p-4 z-30 bottom-14 pb-safe-b">
        <div className="max-w-app mx-auto space-y-3">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <span className="text-sm text-fg-muted shrink-0">
              Total: <strong className="text-foreground">{formatDuration(totalDuration)}</strong>
            </span>
            <div className="flex flex-wrap gap-1.5 justify-end min-w-0">
              <button
                onClick={() => openPicker()}
                className="px-2.5 py-1.5 text-xs font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors whitespace-nowrap shrink-0"
              >
                + Exercise
              </button>
              <button
                onClick={addBreak}
                className="px-2.5 py-1.5 text-xs font-medium text-fg-muted bg-bg-elevated rounded-lg hover:bg-border transition-colors whitespace-nowrap shrink-0"
              >
                + Break
              </button>
              <button
                onClick={addLoop}
                className="px-2.5 py-1.5 text-xs font-medium text-fg-muted bg-bg-elevated rounded-lg hover:bg-border transition-colors whitespace-nowrap shrink-0"
              >
                + Loop
              </button>
            </div>
          </div>
          <Button fullWidth onClick={handleSave} loading={saving}>
            {routine ? 'Update Routine' : 'Save Routine'}
          </Button>
        </div>
      </div>

      {/* Exercise picker */}
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleExerciseSelected}
      />
    </div>
  );
}
