'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { createUser } from '@/lib/firebase/firestore';
import { StepOne } from '@/components/onboarding/StepOne';
import { StepTwo } from '@/components/onboarding/StepTwo';
import { Spinner } from '@/components/ui/Spinner';
import type { ReferralSource } from '@/lib/types';

export default function OnboardingPage() {
  const { firebaseUser, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace('/');
    }
  }, [authLoading, firebaseUser, router]);

  if (authLoading || !firebaseUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  const handleStepOne = (n: string, p: string) => {
    setName(n);
    setPhone(p);
    setStep(2);
  };

  const handleStepTwo = async (
    source: ReferralSource,
    otherText?: string
  ) => {
    setSaving(true);
    try {
      const userData: Parameters<typeof createUser>[1] = {
        name,
        email: firebaseUser.email || '',
        phone: `+972${phone}`,
        referral_source: source,
      };
      if (otherText !== undefined && otherText !== '') {
        userData.referral_source_other = otherText;
      }
      await createUser(firebaseUser.uid, userData);
      await refreshProfile();
      router.replace('/dashboard');
    } catch (err) {
      console.error('Failed to create user:', err);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-safe-t">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="text-fg-muted hover:text-foreground p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <div className="w-7" />
        )}
        <span className="text-sm text-fg-muted">
          {step} of 2
        </span>
      </div>

      {/* Steps */}
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pb-12">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <StepOne
                initialName={name}
                initialPhone={phone}
                onContinue={handleStepOne}
              />
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <StepTwo onSubmit={handleStepTwo} loading={saving} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
