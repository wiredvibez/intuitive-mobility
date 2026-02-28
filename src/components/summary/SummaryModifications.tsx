'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompletedBlock } from '@/lib/types';

interface Modification {
  id: string;
  label: string;
  checked: boolean;
  /** The original block ID in the routine (not the flattened ID) */
  blockId: string;
  type: 'update_duration' | 'remove';
  newDuration?: number;
}

interface SummaryModificationsProps {
  completedBlocks: CompletedBlock[];
  onSave: (modifications: { blockId: string; newDuration?: number; remove?: boolean }[]) => void;
  onKeepAsIs: () => void;
  saving: boolean;
}

interface LoopExerciseAnalysis {
  originalBlockId: string;
  exerciseName: string;
  exerciseId?: string;
  loopId: string;
  totalIterations: number;
  skippedIterations: number[];
  completedIterations: number[];
  allSkipped: boolean;
  someSkipped: boolean;
  /** Max time added across all completed iterations */
  maxTimeAdded: number;
  /** The actual duration from the last completed iteration */
  lastActualDuration: number;
}

/**
 * Analyze completed blocks to understand loop skip patterns
 */
function analyzeLoopPatterns(completedBlocks: CompletedBlock[]): {
  loopAnalysis: Map<string, LoopExerciseAnalysis>;
  loopIterationCounts: Map<string, number>;
} {
  const loopAnalysis = new Map<string, LoopExerciseAnalysis>();
  const loopIterationCounts = new Map<string, number>();

  // First pass: count total iterations per loop
  for (const block of completedBlocks) {
    if (block.loopId && block.loopIteration !== undefined) {
      const currentMax = loopIterationCounts.get(block.loopId) ?? 0;
      loopIterationCounts.set(block.loopId, Math.max(currentMax, block.loopIteration + 1));
    }
  }

  // Second pass: analyze each exercise in loops
  for (const block of completedBlocks) {
    if (block.type !== 'exercise' || !block.loopId || !block.originalBlockId) {
      continue;
    }

    const key = `${block.loopId}:${block.originalBlockId}`;
    let analysis = loopAnalysis.get(key);

    if (!analysis) {
      analysis = {
        originalBlockId: block.originalBlockId,
        exerciseName: block.exercise_name ?? 'Exercise',
        exerciseId: block.exercise_id,
        loopId: block.loopId,
        totalIterations: loopIterationCounts.get(block.loopId) ?? 1,
        skippedIterations: [],
        completedIterations: [],
        allSkipped: false,
        someSkipped: false,
        maxTimeAdded: 0,
        lastActualDuration: 0,
      };
      loopAnalysis.set(key, analysis);
    }

    const iteration = block.loopIteration ?? 0;

    if (block.skipped) {
      analysis.skippedIterations.push(iteration);
    } else {
      analysis.completedIterations.push(iteration);
      if (block.time_added_secs > analysis.maxTimeAdded) {
        analysis.maxTimeAdded = block.time_added_secs;
        analysis.lastActualDuration = block.actual_duration_secs;
      }
    }
  }

  // Final pass: compute allSkipped and someSkipped
  Array.from(loopAnalysis.values()).forEach((analysis) => {
    analysis.allSkipped = analysis.skippedIterations.length === analysis.totalIterations;
    analysis.someSkipped = analysis.skippedIterations.length > 0 && !analysis.allSkipped;
  });

  return { loopAnalysis, loopIterationCounts };
}

/**
 * Generate smart modification suggestions based on completed blocks
 */
function generateModifications(completedBlocks: CompletedBlock[]): Modification[] {
  const modifications: Modification[] = [];
  const processedBlocks = new Set<string>();

  const { loopAnalysis } = analyzeLoopPatterns(completedBlocks);

  // Process loop exercises first (with smart aggregation)
  for (const analysis of Array.from(loopAnalysis.values())) {
    const key = `${analysis.loopId}:${analysis.originalBlockId}`;

    if (analysis.allSkipped) {
      // All iterations skipped - suggest removing from loop
      modifications.push({
        id: `remove_loop_${key}`,
        label: `Remove ${analysis.exerciseName} from loop`,
        checked: true,
        blockId: analysis.originalBlockId,
        type: 'remove',
      });
      processedBlocks.add(analysis.originalBlockId);
    } else if (analysis.maxTimeAdded > 0) {
      // Time was added - suggest updating duration
      modifications.push({
        id: `update_loop_${key}`,
        label: `Update ${analysis.exerciseName} to ${analysis.lastActualDuration}s (+${analysis.maxTimeAdded}s)`,
        checked: true,
        blockId: analysis.originalBlockId,
        type: 'update_duration',
        newDuration: analysis.lastActualDuration,
      });
      processedBlocks.add(analysis.originalBlockId);
    }
  }

  // Process non-loop blocks
  for (const block of completedBlocks) {
    if (block.type !== 'exercise') continue;

    // Skip if this is a loop block (already processed)
    if (block.loopId) continue;

    // Use originalBlockId if available, otherwise use block_id
    const blockId = block.originalBlockId ?? block.block_id;

    // Skip if already processed
    if (processedBlocks.has(blockId)) continue;

    if (block.time_added_secs > 0) {
      modifications.push({
        id: `update_${blockId}`,
        label: `Update ${block.exercise_name} to ${block.actual_duration_secs}s (+${block.time_added_secs}s)`,
        checked: true,
        blockId,
        type: 'update_duration',
        newDuration: block.actual_duration_secs,
      });
      processedBlocks.add(blockId);
    }

    if (block.skipped) {
      modifications.push({
        id: `remove_${blockId}`,
        label: `Remove ${block.exercise_name}`,
        checked: true,
        blockId,
        type: 'remove',
      });
      processedBlocks.add(blockId);
    }
  }

  return modifications;
}

export function SummaryModifications({
  completedBlocks,
  onSave,
  onKeepAsIs,
  saving,
}: SummaryModificationsProps) {
  const initialMods = useMemo(
    () => generateModifications(completedBlocks),
    [completedBlocks]
  );

  const [modifications, setModifications] = useState(initialMods);

  if (modifications.length === 0) return null;

  const toggleMod = (id: string) => {
    setModifications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const handleSave = () => {
    const selected = modifications
      .filter((m) => m.checked)
      .map((m) => ({
        blockId: m.blockId,
        newDuration: m.type === 'update_duration' ? m.newDuration : undefined,
        remove: m.type === 'remove' ? true : undefined,
      }));
    onSave(selected);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
        Save Changes to Routine?
      </h3>

      <div className="space-y-2">
        {modifications.map((mod) => (
          <label
            key={mod.id}
            className="flex items-start gap-3 py-1.5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={mod.checked}
              onChange={() => toggleMod(mod.id)}
              className="mt-0.5 rounded border-border bg-bg-elevated accent-accent"
            />
            <span className="text-sm text-fg-muted">{mod.label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          disabled={saving}
          className="flex-1 !py-2.5 !text-xs"
        >
          Save Changes
        </Button>
        <Button
          variant="secondary"
          onClick={onKeepAsIs}
          disabled={saving}
          className="flex-1 !py-2.5 !text-xs"
        >
          Keep As-Is
        </Button>
      </div>
    </div>
  );
}
