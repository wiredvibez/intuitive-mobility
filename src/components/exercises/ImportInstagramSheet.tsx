'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/providers/AuthProvider';
import { createVideoImportJob } from '@/lib/firebase/firestore';
import { useUIStore } from '@/lib/stores/uiStore';
import { validateInstagramUrl } from '@/lib/utils/validators';

interface ImportInstagramSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ImportInstagramSheet({ open, onClose }: ImportInstagramSheetProps) {
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!firebaseUser) return;
    setError(null);
    const validation = validateInstagramUrl(url.trim());
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setSubmitting(true);
    try {
      await createVideoImportJob(firebaseUser.uid, url.trim());
      addToast('Import started', 'success');
      setUrl('');
      onClose();
    } catch (err) {
      addToast('Failed to start import', 'error');
      setError('Could not create import job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Import from Instagram">
      <div className="p-4 space-y-4">
        <p className="text-sm text-fg-muted">
          Paste an Instagram Reel URL. We&apos;ll analyze it for exercises and let you review before adding.
        </p>
        <Input
          label="Instagram URL"
          placeholder="https://www.instagram.com/reel/xxxxx/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={error ?? undefined}
        />
        <Button fullWidth onClick={handleSubmit} loading={submitting}>
          Start Import
        </Button>
      </div>
    </BottomSheet>
  );
}
