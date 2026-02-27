'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, query, collection, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/providers/AuthProvider';
import type { VideoImportJob } from '@/lib/types';

export function usePendingVideoImports(): VideoImportJob[] {
  const { firebaseUser } = useAuth();
  const [jobs, setJobs] = useState<VideoImportJob[]>([]);

  useEffect(() => {
    if (!firebaseUser) {
      setJobs([]);
      return;
    }
    const q = query(
      collection(db, 'video_import_jobs'),
      where('user_id', '==', firebaseUser.uid),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => d.data() as VideoImportJob)
        .filter((j) => !['complete', 'rejected', 'error'].includes(j.status));
      setJobs(data);
    });
    return () => unsub();
  }, [firebaseUser]);

  return jobs;
}
