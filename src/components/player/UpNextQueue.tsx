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

function getSideLabel(block: FlatBlock): string | null {
  if (block.side === 'right') return 'R';
  if (block.side === 'left') return 'L';
  return null;
}

export function UpNextQueue({ blocks }: UpNextQueueProps) {
  if (blocks.length === 0) return null;

  const [firstBlock, ...restBlocks] = blocks;

  return (
    <div>
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
        Up Next
      </p>
      <div className="flex gap-3 items-end">
        {/* First block - larger with video preview */}
        <div className="shrink-0 w-28 rounded-xl bg-bg-elevated border border-border overflow-hidden">
          {/* Video preview or Rest indicator */}
          <div className="aspect-[4/3] bg-bg-card relative overflow-hidden">
            {firstBlock.type === 'exercise' && firstBlock.media_url ? (
              <video
                src={firstBlock.media_url}
                muted
                loop
                playsInline
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : firstBlock.type === 'break' ? (
              <div className="w-full h-full flex items-center justify-center bg-bg-card">
                <span className="text-xl font-bold text-accent">REST</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-bg-card">
                <span className="text-2xl">
                  {firstBlock.type === 'prep' ? '🏃' : '🧘'}
                </span>
              </div>
            )}
          </div>
          {/* Info */}
          <div className="p-2">
            <div className="flex items-center gap-1">
              <p className={`text-xs font-medium truncate ${firstBlock.type === 'break' ? 'text-accent' : ''}`}>
                {getBlockLabel(firstBlock)}
              </p>
              {getSideLabel(firstBlock) && (
                <span className="shrink-0 px-1 py-0.5 text-[8px] font-semibold rounded bg-accent/15 text-accent">
                  {getSideLabel(firstBlock)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-fg-subtle mt-0.5">
              {formatDurationCompact(firstBlock.duration_secs)}
            </p>
          </div>
        </div>

        {/* Remaining blocks - smaller, horizontal scroll */}
        <div className="flex-1 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 pb-1">
            {restBlocks.map((block, i) => (
              <div
                key={`${block.id}_${i}`}
                className="shrink-0 w-20 rounded-lg bg-bg-elevated border border-border p-2"
              >
                {/* Mini preview */}
                <div className="aspect-square rounded bg-bg-card mb-1.5 overflow-hidden">
                  {block.type === 'exercise' && block.media_url ? (
                    <video
                      src={block.media_url}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  ) : block.type === 'break' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-sm font-bold text-accent">REST</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-lg">
                        {block.type === 'prep' ? '🏃' : '🧘'}
                      </span>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex items-center justify-center gap-1">
                  <p className={`text-[10px] font-medium truncate ${block.type === 'break' ? 'text-accent' : ''}`}>
                    {getBlockLabel(block)}
                  </p>
                  {getSideLabel(block) && (
                    <span className="shrink-0 px-1 py-0.5 text-[8px] font-semibold rounded bg-accent/15 text-accent">
                      {getSideLabel(block)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-fg-subtle text-center mt-0.5">
                  {formatDurationCompact(block.duration_secs)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
