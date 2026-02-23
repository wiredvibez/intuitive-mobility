'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { firebaseUser, profile, loading, isNewUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.replace('/');
      return;
    }

    if (isNewUser && !profile) {
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

  if (!firebaseUser) return null;
  if (isNewUser && !profile) return null;

  return <>{children}</>;
}
