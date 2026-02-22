'use client';

import { formatDurationCompact } from '@/lib/utils/formatters';
import type { CompletedBlock } from '@/lib/types';

interface BlocksListProps {
  blocks: CompletedBlock[];
}

export function BlocksList({ blocks }: BlocksListProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
        Blocks Completed
      </h3>
      {blocks.map((block, i) => {
        const icon = block.skipped ? '⊘' : '✓';
        const iconColor = block.skipped ? 'text-fg-subtle' : 'text-success';
        const nameColor = block.skipped ? 'text-fg-subtle line-through' : 'text-foreground';

        const label =
          block.type === 'exercise'
            ? block.exercise_name || 'Exercise'
            : block.type === 'break'
              ? 'Rest'
              : block.type === 'prep'
                ? 'Prep'
                : 'Cooldown';

        return (
          <div
            key={`${block.block_id}_${i}`}
            className="flex items-center gap-3 py-1.5"
          >
            <span className={`text-sm ${iconColor}`}>{icon}</span>
            <span className={`text-sm flex-1 ${nameColor}`}>{label}</span>
            {block.skipped ? (
              <span className="text-xs text-fg-subtle">skipped</span>
            ) : (
              <span className="text-xs text-fg-muted">
                {formatDurationCompact(block.actual_duration_secs)}
                {block.time_added_secs > 0 && (
                  <span className="text-accent ml-1">
                    +{block.time_added_secs}s
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
