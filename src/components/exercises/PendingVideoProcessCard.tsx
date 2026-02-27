'use client';

import { useRouter } from 'next/navigation';
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
  error: 'Error',
};

interface PendingVideoProcessCardProps {
  job: VideoImportJob;
}

export function PendingVideoProcessCard({ job }: PendingVideoProcessCardProps) {
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const isProcessing = !['await_approve', 'incomplete_approve', 'error'].includes(job.status);
  const isReady = ['await_approve', 'incomplete_approve'].includes(job.status);
  const isError = job.status === 'error';

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
    } catch (err) {
      addToast('Failed to dismiss', 'error');
    }
  };

  return (
    <div className="mb-4 rounded-xl bg-bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {STATUS_LABELS[job.status] ?? job.status}
          </p>
          {isError && job.status_message && (
            <p className="text-xs text-danger mt-0.5">{job.status_message}</p>
          )}
          {isProcessing && (
            <p className="text-xs text-fg-muted mt-0.5">Import from Instagram</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && <Spinner className="w-5 h-5" />}
          {isReady && (
            <Button
              variant="primary"
              onClick={handleReview}
              className="!py-2 !px-3 !text-xs"
            >
              Review
            </Button>
          )}
          {isError && (
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
