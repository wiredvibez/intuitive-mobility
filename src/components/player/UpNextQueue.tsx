'use client';

import { formatDurationCompact } from '@/lib/utils/formatters';
import type { FlatBlock } from '@/lib/types';

interface UpNextQueueProps {
  blocks: FlatBlock[];
}

function getBlockLabel(block: FlatBlock): string {
  if (block.type === 'exercise') return block.exercise_name || 'Exercise';
  if (block.type === 'break') return 'Rest';
  if (block.type === 'prep') return 'Prep';
  if (block.type === 'cooldown') return 'Cooldown';
  return 'Block';
}

function getBlockColor(block: FlatBlock): string {
  if (block.type === 'exercise') return 'border-accent/40';
  if (block.type === 'break') return 'border-fg-subtle/30';
  return 'border-accent/20';
}

export function UpNextQueue({ blocks }: UpNextQueueProps) {
  if (blocks.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
        Up Next
      </p>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {blocks.map((block, i) => (
          <div
            key={`${block.id}_${i}`}
            className={`
              shrink-0 w-20 rounded-lg bg-bg-elevated border p-2 text-center
              ${getBlockColor(block)}
            `}
          >
            <p className="text-[10px] font-medium truncate">{getBlockLabel(block)}</p>
            <p className="text-xs text-fg-subtle mt-0.5">
              {formatDurationCompact(block.duration_secs)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
