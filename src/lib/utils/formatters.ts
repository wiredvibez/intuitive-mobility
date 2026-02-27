import type { RoutineBlock } from '../types';

/** Format seconds as M:SS or H:MM:SS */
export function formatDuration(totalSecs: number): string {
  if (totalSecs < 0) totalSecs = 0;
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = Math.floor(totalSecs % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Format seconds as compact string, e.g. "1m 30s" or "45s" */
export function formatDurationCompact(totalSecs: number): string {
  if (totalSecs < 0) totalSecs = 0;
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

/** Calculate total routine duration in seconds, including loops */
export function calculateRoutineDuration(
  blocks: RoutineBlock[],
  prepTimeSecs: number,
  cooldownTimeSecs: number
): number {
  let total = prepTimeSecs + cooldownTimeSecs;

  for (const block of blocks) {
    if (block.type === 'exercise' || block.type === 'break') {
      total += block.duration_secs;
    } else if (block.type === 'loop') {
      const loopBlockDuration = block.blocks.reduce(
        (sum, b) => sum + b.duration_secs,
        0
      );
      total += loopBlockDuration * block.iterations;
    }
  }

  return total;
}

/** Count total exercise blocks (including inside loops) */
export function countExerciseBlocks(blocks: RoutineBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    if (block.type === 'exercise') count++;
    else if (block.type === 'loop') {
      count += block.blocks.filter((b) => b.type === 'exercise').length * block.iterations;
    }
  }
  return count;
}

/** Format a date as relative time, e.g. "2 days ago" */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHrs > 0) return `${diffHrs}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

/** Format date as short string, e.g. "Jan 15, 2025" */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format phone number for display: XX-XXX-XXXX */
export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 9)}`;
}
