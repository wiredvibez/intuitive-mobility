'use client';

import { useState, useCallback } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/providers/AuthProvider';
import {
  useOfflineEnabled,
  useCachedRoutines,
  useOfflineStorageUsed,
  formatBytes,
} from '@/lib/hooks/useOfflineCache';
import { SwipeableRoutineItem } from './SwipeableRoutineItem';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { firebaseUser } = useAuth();
  const { enabled, loading: enabledLoading, toggle } = useOfflineEnabled();
  const { routines, loading: routinesLoading, removeRoutine } = useCachedRoutines(
    firebaseUser?.uid
  );
  const { bytes, refetch: refetchStorage } = useOfflineStorageUsed();

  const [confirmDisable, setConfirmDisable] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = useCallback(async () => {
    if (enabled) {
      setConfirmDisable(true);
    } else {
      setToggling(true);
      await toggle(true);
      setToggling(false);
    }
  }, [enabled, toggle]);

  const handleConfirmDisable = useCallback(async () => {
    setToggling(true);
    await toggle(false);
    setToggling(false);
    refetchStorage();
  }, [toggle, refetchStorage]);

  const handleRemoveRoutine = useCallback(
    async (routineId: string) => {
      await removeRoutine(routineId);
      refetchStorage();
    },
    [removeRoutine, refetchStorage]
  );

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Settings">
        <div className="px-4 py-4">
          {/* Offline Data Section */}
          <section>
            <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">
              Offline Data
            </h4>

            {/* Storage + Toggle */}
            <div className="bg-bg-elevated rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Offline Access</p>
                  {enabled && bytes > 0 && (
                    <p className="text-sm text-fg-muted">
                      Using {formatBytes(bytes)}
                    </p>
                  )}
                  {!enabled && (
                    <p className="text-sm text-fg-muted">
                      Save workouts for offline use
                    </p>
                  )}
                </div>
                <button
                  onClick={handleToggle}
                  disabled={enabledLoading || toggling}
                  className={`
                    relative w-12 h-7 rounded-full transition-colors
                    ${enabled ? 'bg-accent' : 'bg-fg-subtle/30'}
                    ${enabledLoading || toggling ? 'opacity-50' : ''}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md
                      transition-transform duration-200
                      ${enabled ? 'left-[22px]' : 'left-0.5'}
                    `}
                  />
                </button>
              </div>
            </div>

            {/* Saved Routines List */}
            {enabled && !routinesLoading && (
              <div>
                {routines.length > 0 ? (
                  <>
                    <p className="text-sm text-fg-muted mb-2">
                      Saved for Offline
                    </p>
                    <div className="space-y-2">
                      {routines.map((cached) => (
                        <SwipeableRoutineItem
                          key={cached.id}
                          routine={cached}
                          onRemove={() => handleRemoveRoutine(cached.id)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-fg-muted text-center py-4">
                    No routines saved offline yet. Start a workout or pin a
                    routine to save it.
                  </p>
                )}
              </div>
            )}

            {enabled && routinesLoading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </section>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={handleConfirmDisable}
        title="Disable Offline Access?"
        message="This will delete all cached workouts and videos. You can re-enable this anytime."
        confirmLabel="Disable"
        cancelLabel="Keep"
        variant="danger"
        loading={toggling}
      />
    </>
  );
}
