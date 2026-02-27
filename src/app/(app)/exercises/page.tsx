'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useExercises } from '@/lib/hooks/useExercises';
import { usePendingVideoImports } from '@/lib/hooks/usePendingVideoImports';
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { PendingVideoProcessCard } from '@/components/exercises/PendingVideoProcessCard';
import { ImportInstagramSheet } from '@/components/exercises/ImportInstagramSheet';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise } from '@/lib/types';

export default function ExercisesPage() {
  const router = useRouter();
  const [showImportSheet, setShowImportSheet] = useState(false);
  const { exercises, loading } = useExercises(true);
  const pendingImports = usePendingVideoImports();

  const handleSelect = (exercise: Exercise) => {
    router.push(`/exercises/${exercise.id}`);
  };

  return (
    <div className="px-4 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="font-display font-bold text-5xl leading-none tracking-tight mb-5">
          Exercises
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportSheet(true)}
            className="flex-1 py-2.5 rounded-xl bg-bg-card border border-border text-sm font-medium text-fg-muted hover:border-fg-subtle hover:text-foreground transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => router.push('/exercises/new')}
            className="flex-1 py-2.5 rounded-xl bg-accent text-accent-fg text-sm font-bold hover:bg-accent-hover transition-colors"
          >
            + Create
          </button>
        </div>
      </motion.div>

      {/* Pending imports */}
      {pendingImports.length > 0 && (
        <div className="mb-4 space-y-2">
          {pendingImports.map((job) => (
            <PendingVideoProcessCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <ImportInstagramSheet
        open={showImportSheet}
        onClose={() => setShowImportSheet(false)}
      />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : exercises.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center justify-center py-16 text-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <path d="M6.5 6.5h11M6.5 17.5h11" />
              <rect x="2" y="8.5" width="4" height="7" rx="1" />
              <rect x="18" y="8.5" width="4" height="7" rx="1" />
              <line x1="12" y1="6.5" x2="12" y2="17.5" />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-xl mb-1">No exercises yet</p>
            <p className="text-sm text-fg-muted">Create or import your first exercise</p>
          </div>
          <div className="flex gap-2 w-full max-w-[240px]">
            <Button variant="secondary" className="flex-1 !text-xs" onClick={() => setShowImportSheet(true)}>
              Import
            </Button>
            <Button className="flex-1 !text-xs" onClick={() => router.push('/exercises/new')}>
              Create
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {exercises.map((ex, i) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <ExerciseCard
                exercise={ex}
                onSelect={handleSelect}
                compact
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
