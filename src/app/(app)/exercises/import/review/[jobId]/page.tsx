'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getVideoImportJob } from '@/lib/firebase/firestore';
import { ImportReviewPlayer } from '@/components/exercises/ImportReviewPlayer';
import { Spinner } from '@/components/ui/Spinner';
import type { VideoImportJob } from '@/lib/types';

export default function ImportReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<VideoImportJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser || !jobId) return;
    getVideoImportJob(jobId).then((j) => {
      setJob(j ?? null);
      setLoading(false);
    });
  }, [firebaseUser, jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  if (!job || job.user_id !== firebaseUser?.uid) {
    router.replace('/exercises');
    return null;
  }

  if (!['await_approve', 'incomplete_approve'].includes(job.status)) {
    router.replace('/exercises');
    return null;
  }

  return (
    <ImportReviewPlayer
      job={job}
      onComplete={() => router.replace('/exercises')}
    />
  );
}
