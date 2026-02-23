'use client';

import { useState, useMemo } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { ChipSelector } from './ChipSelector';
import { ExerciseCard } from './ExerciseCard';
import { useExercises, searchExercises } from '@/lib/hooks/useExercises';
import { useAuth } from '@/providers/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise } from '@/lib/types';

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

export function ExercisePicker({ open, onClose, onSelect }: ExercisePickerProps) {
  const { firebaseUser } = useAuth();
  const { exercises, loading } = useExercises();
  const [query, setQuery] = useState('');
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [myOnly, setMyOnly] = useState(false);

  const filtered = useMemo(
    () => searchExercises(exercises, query, activeChips, myOnly, firebaseUser?.uid),
    [exercises, query, activeChips, myOnly, firebaseUser?.uid]
  );

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onClose();
    setQuery('');
    setActiveChips([]);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Pick Exercise" fullHeight>
      <div className="p-4 space-y-3">
        {/* Search */}
        <Input
          placeholder="🔍 Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Chip filters */}
        <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
          <ChipSelector selected={activeChips} onChange={setActiveChips} />
        </div>

        {/* My exercises toggle */}
        <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={myOnly}
            onChange={(e) => setMyOnly(e.target.checked)}
            className="rounded border-border bg-bg-elevated accent-accent"
          />
          My Exercises Only
        </label>
      </div>

      {/* Grid */}
      <div className="px-4 pb-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-fg-muted text-sm">
            No exercises found
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                onSelect={handleSelect}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
