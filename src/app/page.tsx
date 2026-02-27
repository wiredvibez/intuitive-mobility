'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Spinner } from '@/components/ui/Spinner';

export default function SignInPage() {
  const { firebaseUser, profile, loading, isNewUser, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && profile) {
      router.replace('/dashboard');
    } else if (firebaseUser && isNewUser) {
      router.replace('/onboarding');
    }
  }, [firebaseUser, profile, loading, isNewUser, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  if (firebaseUser) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-12">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="font-display font-bold text-6xl leading-none tracking-tight">
            INTUITIVE
          </h1>
          <h1 className="font-display font-bold text-6xl leading-none tracking-tight text-accent">
            MOBILITY
          </h1>
          <p className="text-sm text-fg-muted mt-5">
            Your personal workout companion
          </p>
        </div>

        {/* Sign In */}
        <div className="space-y-4">
          <GoogleSignInButton onSignIn={signInWithGoogle} />

          <p className="text-center text-xs text-fg-subtle leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="underline">Terms of Service</span> and{' '}
            <span className="underline">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
