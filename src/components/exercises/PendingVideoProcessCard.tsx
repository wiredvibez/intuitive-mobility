'use client';

import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { functions, httpsCallable } from '@/lib/firebase/config';
import { useUIStore } from '@/lib/stores/uiStore';
import type { VideoImportJob } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  created: 'Starting...',
  invoked: 'Processing...',
  v_downloaded: 'Analyzing video...',
  analyzed: 'Cutting clips...',
  await_approve: 'Ready to review',
  incomplete_approve: 'Ready to review',
  error: 'Import failed',
};

// Jobs stuck in a processing state for longer than this are considered timed out
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingVideoProcessCardProps {
  job: VideoImportJob;
}

export function PendingVideoProcessCard({ job }: PendingVideoProcessCardProps) {
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);

  const isProcessing = !['await_approve', 'incomplete_approve', 'error'].includes(job.status);
  const isReady = ['await_approve', 'incomplete_approve'].includes(job.status);
  const isError = job.status === 'error';

  // Get pending exercise count and Instagram handle for ready state
  const pendingCount = job.exercises.filter((e) => e.status === 'pending').length;
  const instagramHandle = job.instagram_metadata?.author?.username
    ? `@${job.instagram_metadata.author.username}`
    : null;

  const isStuck = isProcessing && (() => {
    if (!job.updated_at) return false;
    const updatedMs = job.updated_at instanceof Timestamp
      ? job.updated_at.toMillis()
      : (job.updated_at as { seconds: number }).seconds * 1000;
    return Date.now() - updatedMs > PROCESSING_TIMEOUT_MS;
  })();

  const handleReview = () => {
    router.push(`/exercises/import/review/${job.id}`);
  };

  const handleDismiss = async () => {
    try {
      const reject = httpsCallable<{ jobId: string }, { success: boolean }>(
        functions,
        'rejectImportJobCallable'
      );
      await reject({ jobId: job.id });
      addToast('Dismissed', 'info');
    } catch {
      addToast('Failed to dismiss', 'error');
    }
  };

  // Build the ready message with count and handle
  const getReadyMessage = () => {
    if (!isReady) return null;
    const exerciseWord = pendingCount === 1 ? 'exercise' : 'exercises';
    if (instagramHandle) {
      return `${pendingCount} ${exerciseWord} from ${instagramHandle} ready for review`;
    }
    return `${pendingCount} ${exerciseWord} ready for review`;
  };

  return (
    <div className="mb-4 rounded-xl bg-bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {isStuck
              ? 'Import timed out'
              : isReady
                ? getReadyMessage()
                : (STATUS_LABELS[job.status] ?? job.status)}
          </p>
          {isError && job.status_message && (
            <p className="text-xs text-danger mt-0.5">{job.status_message}</p>
          )}
          {isStuck && (
            <p className="text-xs text-danger mt-0.5">Something went wrong. You can dismiss this import.</p>
          )}
          {isProcessing && !isStuck && (
            <p className="text-xs text-fg-muted mt-0.5">Come back later!</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && !isStuck && <Spinner className="w-5 h-5" />}
          {isReady && (
            <Button
              variant="primary"
              onClick={handleReview}
              className="!py-2 !px-3 !text-xs"
            >
              Review
            </Button>
          )}
          {(isError || isStuck) && (
            <Button
              variant="secondary"
              onClick={handleDismiss}
              className="!py-2 !px-3 !text-xs"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
