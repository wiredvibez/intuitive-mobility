'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Exercise } from '@/lib/types';

interface BlockConfigInlineProps {
  exercise: Exercise;
  onConfirm: (config: { reps?: number; duration_secs: number }) => void;
  onRemove: () => void;
  initialReps?: number;
  initialDuration?: number;
}

export function BlockConfigInline({
  exercise,
  onConfirm,
  onRemove,
  initialReps,
  initialDuration,
}: BlockConfigInlineProps) {
  const isRepeat = exercise.type === 'repeat';
  const defaultTimePerRep = exercise.default_time_per_rep_secs || 2;

  const [reps, setReps] = useState(initialReps?.toString() || '10');
  const [duration, setDuration] = useState(
    initialDuration?.toString() ||
      (isRepeat ? String(parseInt(reps) * defaultTimePerRep) : '30')
  );
  const [overrideDuration, setOverrideDuration] = useState(!!initialDuration && isRepeat);

  const calculatedDuration = isRepeat
    ? parseInt(reps || '0') * defaultTimePerRep
    : parseInt(duration || '0');

  const finalDuration = isRepeat && !overrideDuration
    ? calculatedDuration
    : parseInt(duration || '0');

  const handleConfirm = () => {
    onConfirm({
      reps: isRepeat ? parseInt(reps || '0') : undefined,
      duration_secs: finalDuration || 1,
    });
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="p-3 space-y-3 bg-bg-elevated/50 rounded-b-xl">
        {isRepeat ? (
          <>
            <Input
              label="How many reps?"
              type="number"
              value={reps}
              onChange={(e) => {
                setReps(e.target.value);
                if (!overrideDuration) {
                  setDuration(
                    String(parseInt(e.target.value || '0') * defaultTimePerRep)
                  );
                }
              }}
              min={1}
            />
            <p className="text-xs text-fg-muted">
              Duration: {calculatedDuration}s ({defaultTimePerRep}s × {reps || 0} reps)
            </p>
            {!overrideDuration ? (
              <button
                onClick={() => setOverrideDuration(true)}
                className="text-xs text-accent"
              >
                Override duration
              </button>
            ) : (
              <Input
                label="Custom duration (seconds)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
              />
            )}
          </>
        ) : (
          <Input
            label="Duration (seconds)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min={1}
          />
        )}

        <div className="flex gap-2">
          <Button variant="primary" onClick={handleConfirm} className="flex-1 !py-2 !text-xs">
            Confirm
          </Button>
          <Button variant="danger" onClick={onRemove} className="!py-2 !text-xs">
            Remove
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
