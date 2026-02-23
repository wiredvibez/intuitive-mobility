'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { validateUserName, validateIsraeliPhone } from '@/lib/utils/validators';
import { formatPhoneDisplay } from '@/lib/utils/formatters';

interface StepOneProps {
  initialName: string;
  initialPhone: string;
  onContinue: (name: string, phone: string) => void;
}

export function StepOne({ initialName, initialPhone, onContinue }: StepOneProps) {
  const [name, setName] = useState(initialName);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 10) {
      setPhoneDigits(raw);
    }
  }, []);

  const handleContinue = () => {
    const nameError = validateUserName(name);
    const phoneValid = validateIsraeliPhone(phoneDigits);
    const newErrors: typeof errors = {};

    if (nameError) newErrors.name = nameError;
    if (!phoneValid) newErrors.phone = 'Enter a valid phone number';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onContinue(name.trim(), phoneDigits);
  };

  return (
    <div className="space-y-6">
      <Input
        label="What should we call you?"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoFocus
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-fg-muted">
          Phone number
        </label>
        <div className="flex gap-2">
          <div className="flex items-center px-3 rounded-xl bg-bg-elevated border border-border text-sm text-fg-muted shrink-0">
            +972
          </div>
          <Input
            type="tel"
            placeholder="50-123-4567"
            value={formatPhoneDisplay(phoneDigits)}
            onChange={handlePhoneChange}
            error={errors.phone}
            className="flex-1"
          />
        </div>
      </div>

      <Button fullWidth onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}
