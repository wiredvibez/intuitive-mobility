'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ReferralSource } from '@/lib/types';

interface StepTwoProps {
  onSubmit: (source: ReferralSource, otherText?: string) => void;
  loading: boolean;
}

const options: { value: ReferralSource; label: string }[] = [
  { value: 'yair', label: 'From Yair' },
  { value: 'friend', label: 'From a friend' },
  { value: 'social_media', label: 'From Social Media' },
  { value: 'other', label: 'Other' },
];

export function StepTwo({ onSubmit, loading }: StepTwoProps) {
  const [selected, setSelected] = useState<ReferralSource | null>(null);
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!selected) {
      setError('Please select an option');
      return;
    }
    if (selected === 'other' && !otherText.trim()) {
      setError('Please tell us more');
      return;
    }
    setError('');
    onSubmit(selected, selected === 'other' ? otherText.trim() : undefined);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">How did you hear about us?</h2>

      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              setSelected(option.value);
              setError('');
            }}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left
              transition-colors border
              ${
                selected === option.value
                  ? 'bg-accent/10 border-accent text-foreground'
                  : 'bg-bg-elevated border-border text-fg-muted hover:border-fg-subtle'
              }
            `}
          >
            <div
              className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                ${selected === option.value ? 'border-accent' : 'border-fg-subtle'}
              `}
            >
              {selected === option.value && (
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              )}
            </div>
            {option.label}
          </button>
        ))}

        <AnimatePresence>
          {selected === 'other' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <Input
                  placeholder="Tell us more..."
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button fullWidth onClick={handleSubmit} loading={loading}>
        Get Started
      </Button>
    </div>
  );
}
