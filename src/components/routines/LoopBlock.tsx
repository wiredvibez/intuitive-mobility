'use client';

import { Reorder } from 'motion/react';
import { RoutineBlockCard } from './RoutineBlockCard';
import type { LoopBlock as LoopBlockType, ExerciseBlock, BreakBlock, Exercise } from '@/lib/types';

interface LoopBlockProps {
  loop: LoopBlockType;
  onUpdate: (loop: LoopBlockType) => void;
  onRemove: () => void;
  onAddExercise: (insertAfterIndex?: number) => void;
  exerciseDataMap: Map<string, Exercise>;
}

export function LoopBlockComponent({
  loop,
  onUpdate,
  onRemove,
  onAddExercise,
  exerciseDataMap,
}: LoopBlockProps) {
  const handleBlockUpdate = (index: number, block: ExerciseBlock | BreakBlock) => {
    const newBlocks = [...loop.blocks];
    newBlocks[index] = block;
    onUpdate({ ...loop, blocks: newBlocks });
  };

  const handleBlockRemove = (index: number) => {
    const newBlocks = loop.blocks.filter((_, i) => i !== index);
    if (newBlocks.length === 0) {
      onRemove();
      return;
    }
    onUpdate({ ...loop, blocks: newBlocks });
  };

  const handleReorder = (newBlocks: (ExerciseBlock | BreakBlock)[]) => {
    onUpdate({ ...loop, blocks: newBlocks });
  };

  return (
    <div className="mb-2 border-2 border-accent/30 rounded-xl overflow-hidden bg-accent/5">
      {/* Loop header */}
      <div className="flex items-center justify-between px-3 py-2 bg-accent/10 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent">LOOP</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                onUpdate({ ...loop, iterations: Math.max(1, loop.iterations - 1) })
              }
              className="w-6 h-6 rounded bg-bg-elevated text-xs flex items-center justify-center"
            >
              −
            </button>
            <span className="text-sm font-semibold text-accent w-6 text-center">
              {loop.iterations}×
            </span>
            <button
              onClick={() => onUpdate({ ...loop, iterations: loop.iterations + 1 })}
              className="w-6 h-6 rounded bg-bg-elevated text-xs flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-fg-subtle hover:text-danger text-xs p-1"
        >
          ✕
        </button>
      </div>

      {/* Nested blocks */}
      <div className="p-2">
        {loop.blocks.length === 0 ? (
          <div className="text-center py-4 text-xs text-fg-muted">
            Empty loop —{' '}
            <button onClick={() => onAddExercise()} className="text-accent">
              add an exercise
            </button>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={loop.blocks}
            onReorder={handleReorder}
            className="space-y-0"
          >
            {loop.blocks.map((block, index) => (
              <RoutineBlockCard
                key={block.id}
                block={block}
                onUpdate={(updated) => handleBlockUpdate(index, updated)}
                onRemove={() => handleBlockRemove(index)}
                onAddBelow={() => onAddExercise(index)}
                exerciseData={
                  block.type === 'exercise'
                    ? exerciseDataMap.get(block.exercise_id)
                    : undefined
                }
              />
            ))}
          </Reorder.Group>
        )}

        <button
          onClick={() => onAddExercise()}
          className="w-full py-2 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors mt-1"
        >
          + Add to Loop
        </button>
      </div>
    </div>
  );
}
