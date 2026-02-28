'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { MobileShell } from '@/components/layout/MobileShell';
import { SettingsSheet } from '@/components/settings/SettingsSheet';

export default function ProfilePage() {
  const { firebaseUser } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const displayName = firebaseUser?.displayName || 'User';
  const email = firebaseUser?.email || '';
  const photoURL = firebaseUser?.photoURL;

  return (
    <MobileShell>
      <div className="min-h-screen bg-bg pb-24">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-border">
          <div className="max-w-app mx-auto px-4 h-14 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Profile</h1>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-elevated text-fg-muted"
              aria-label="Settings"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Profile Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-app mx-auto px-4 pt-8"
        >
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-bg-elevated border-2 border-border overflow-hidden mb-4">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-semibold text-fg-muted">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name & Email */}
            <h2 className="text-xl font-semibold mb-1">{displayName}</h2>
            <p className="text-sm text-fg-muted">{email}</p>
          </div>

          {/* Stats placeholder - can be expanded later */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <p className="text-2xl font-bold text-accent">—</p>
              <p className="text-sm text-fg-muted">Workouts</p>
            </div>
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <p className="text-2xl font-bold text-accent">—</p>
              <p className="text-sm text-fg-muted">Routines</p>
            </div>
          </div>
        </motion.div>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MobileShell>
  );
}
