'use client';

import { useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import { BlockConfigInline } from './BlockConfigInline';
import { formatDurationCompact } from '@/lib/utils/formatters';
import type { ExerciseBlock, BreakBlock, RoutineBlock } from '@/lib/types';
import { BREAK_DURATION_PRESETS } from '@/lib/types';

interface RoutineBlockCardProps {
  block: ExerciseBlock | BreakBlock;
  onUpdate: (block: ExerciseBlock | BreakBlock) => void;
  onRemove: () => void;
  onAddBelow: () => void;
  isNew?: boolean;
  exerciseData?: {
    name: string;
    description: string;
    type: 'repeat' | 'timed';
    default_time_per_rep_secs?: number;
    media_url: string;
    media_type: 'video' | 'gif' | 'photo';
    id: string;
  };
}

export function RoutineBlockCard({
  block,
  onUpdate,
  onRemove,
  onAddBelow,
  isNew = false,
  exerciseData,
}: RoutineBlockCardProps) {
  const dragControls = useDragControls();
  const [editing, setEditing] = useState(isNew && block.type === 'exercise');

  if (block.type === 'break') {
    return (
      <Reorder.Item
        value={block}
        dragListener={false}
        dragControls={dragControls}
        className="mb-2"
      >
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <button
              onPointerDown={(e) => dragControls.start(e)}
              className="touch-none text-fg-subtle hover:text-fg-muted cursor-grab active:cursor-grabbing"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
            <span className="text-xs text-fg-muted">⏸</span>
            <span className="text-sm font-medium text-fg-muted flex-1">Rest</span>
            <select
              value={block.duration_secs}
              onChange={(e) =>
                onUpdate({ ...block, duration_secs: parseInt(e.target.value) })
              }
              className="bg-bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-foreground"
            >
              {BREAK_DURATION_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
            <button
              onClick={onRemove}
              className="text-fg-subtle hover:text-danger text-xs p-1"
            >
              ✕
            </button>
          </div>
          <button
            onClick={onAddBelow}
            className="w-full py-1.5 text-[11px] text-accent hover:bg-bg-elevated/50 border-t border-border"
          >
            + Add Below
          </button>
        </div>
      </Reorder.Item>
    );
  }

  // Exercise block
  const exBlock = block as ExerciseBlock;

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={dragControls}
      className="mb-2"
    >
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onPointerDown={(e) => dragControls.start(e)}
            className="touch-none text-fg-subtle hover:text-fg-muted cursor-grab active:cursor-grabbing"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>

          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-elevated shrink-0">
            {exBlock.media_url ? (
              exBlock.media_type === 'video' ? (
                <video src={exBlock.media_url} muted className="w-full h-full object-cover" />
              ) : (
                <img src={exBlock.media_url} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-fg-subtle text-xs">🎬</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{exBlock.exercise_name}</p>
            <p className="text-xs text-fg-muted">
              {exBlock.reps ? `${exBlock.reps} reps · ` : ''}
              {formatDurationCompact(exBlock.duration_secs)}
            </p>
          </div>

          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-accent font-medium px-2 py-1"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={onRemove}
            className="text-fg-subtle hover:text-danger text-xs p-1"
          >
            ✕
          </button>
        </div>

        {/* Inline config */}
        <AnimatePresence>
          {editing && exerciseData && (
            <BlockConfigInline
              exercise={exerciseData as any}
              initialReps={exBlock.reps}
              initialDuration={exBlock.duration_secs}
              onConfirm={({ reps, duration_secs }) => {
                onUpdate({
                  ...exBlock,
                  reps,
                  duration_secs,
                });
                setEditing(false);
              }}
              onRemove={onRemove}
            />
          )}
        </AnimatePresence>

        <button
          onClick={onAddBelow}
          className="w-full py-1.5 text-[11px] text-accent hover:bg-bg-elevated/50 border-t border-border"
        >
          + Add Below
        </button>
      </div>
    </Reorder.Item>
  );
}
