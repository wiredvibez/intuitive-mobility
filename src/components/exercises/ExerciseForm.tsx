'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { updateUser } from '@/lib/firebase/firestore';
import { EXERCISE_CHIPS, EXERCISE_TYPE_LABELS } from '@/lib/types';
import { useUIStore } from '@/lib/stores/uiStore';
import { createExercise, updateExercise } from '@/lib/firebase/firestore';
import { uploadExerciseMedia } from '@/lib/firebase/storage';
import { useExerciseMediaUrl } from '@/lib/hooks/useExerciseMediaUrl';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ChipSelector } from './ChipSelector';
import { VideoTrimmer } from './VideoTrimmer';
import { ImportVideoTrimmer } from './ImportVideoTrimmer';
import { RepeatIcon, TimerIcon, XIcon, ScissorsIcon, RefreshIcon } from '@/components/ui/Icons';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  validateExerciseName,
  getMediaTypeFromFile,
  isVideoFile,
  ACCEPTED_MEDIA_TYPES,
} from '@/lib/utils/validators';
import type { Exercise, ExerciseType, MediaType } from '@/lib/types';

interface ExerciseFormProps {
  exercise?: Exercise;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExerciseForm({ exercise, onSuccess, onCancel }: ExerciseFormProps) {
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve media URL for imported exercises that use storage_path
  const resolvedMediaUrl = useExerciseMediaUrl(exercise);

  const [name, setName] = useState(exercise?.name || '');
  const [description, setDescription] = useState(exercise?.description || '');
  const [type, setType] = useState<ExerciseType>(exercise?.type || 'repeat');
  const [timePerRep, setTimePerRep] = useState(
    exercise?.default_time_per_rep_secs?.toString() || '2'
  );
  const [chips, setChips] = useState<string[]>(exercise?.chips || []);
  const [twoSided, setTwoSided] = useState(exercise?.two_sided ?? false);
  const [isPublic, setIsPublic] = useState(exercise?.is_public ?? false);
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>(
    exercise?.media_type || 'video'
  );
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [trimSource, setTrimSource] = useState<File | null>(null);
  const [showUrlTrimmer, setShowUrlTrimmer] = useState(false);
  const [showMediaActions, setShowMediaActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Set media preview once resolved URL is available
  useEffect(() => {
    if (!mediaFile && resolvedMediaUrl) {
      setMediaPreview(resolvedMediaUrl);
    }
  }, [resolvedMediaUrl, mediaFile]);

  const isDirty = useMemo(() => {
    if (name !== (exercise?.name || '')) return true;
    if (description !== (exercise?.description || '')) return true;
    if (type !== (exercise?.type || 'repeat')) return true;
    if (
      timePerRep !==
      (exercise?.default_time_per_rep_secs?.toString() || '2')
    )
      return true;
    const exChips = exercise?.chips ?? [];
    const chipsSet = new Set(chips);
    const exChipsSet = new Set(exChips);
    if (
      chips.length !== exChips.length ||
      chips.some((c) => !exChipsSet.has(c)) ||
      exChips.some((c) => !chipsSet.has(c))
    )
      return true;
    if (twoSided !== (exercise?.two_sided ?? false)) return true;
    if (isPublic !== (exercise?.is_public ?? false)) return true;
    if (mediaFile) return true;
    return false;
  }, [
    name,
    description,
    type,
    timePerRep,
    chips,
    twoSided,
    isPublic,
    mediaFile,
    exercise,
  ]);

  const handleCancel = () => {
    if (isDirty && onCancel) {
      setShowDiscardModal(true);
      return;
    }
    onCancel?.();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isVideoFile(file)) {
      setTrimSource(file);
      setShowTrimmer(true);
      return;
    }

    setMediaFile(file);
    setMediaType(getMediaTypeFromFile(file));
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleTrimComplete = (blob: Blob) => {
    setMediaFile(blob);
    setMediaType('video');
    setMediaPreview(URL.createObjectURL(blob));
    setShowTrimmer(false);
    setTrimSource(null);
  };

  const handleUrlTrimComplete = (blob: Blob) => {
    setMediaFile(blob);
    setMediaType('video');
    setMediaPreview(URL.createObjectURL(blob));
    setShowUrlTrimmer(false);
  };

  const hasExistingMedia = !mediaFile && resolvedMediaUrl;
  const hasNewMedia = !!mediaFile;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const nameErr = validateExerciseName(name);
    if (nameErr) newErrors.name = nameErr;
    if (!mediaFile && !exercise?.media_url) newErrors.media = 'Media is required';
    if (type === 'repeat' && (!timePerRep || parseInt(timePerRep) <= 0)) {
      newErrors.timePerRep = 'Enter seconds per rep';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!firebaseUser) {
      addToast('Please sign in to save', 'error');
      return;
    }
    
    if (!validate()) {
      addToast('Please fix the errors above', 'error');
      return;
    }
    
    setSaving(true);

    try {
      let finalMediaUrl = exercise?.media_url || '';
      const exerciseId = exercise?.id || Date.now().toString(36);

      if (mediaFile) {
        addToast('Uploading video...', 'info');
        const upload = await uploadExerciseMedia(
          firebaseUser.uid,
          mediaFile,
          exerciseId
        );
        finalMediaUrl = upload.url;
      }

      const data: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'> = {
        author_id: firebaseUser.uid,
        name: name.trim(),
        description: description.trim(),
        type,
        media_url: finalMediaUrl,
        media_type: mediaType,
        chips,
        two_sided: twoSided,
        is_public: isPublic,
        ...(type === 'repeat' ? { default_time_per_rep_secs: parseInt(timePerRep) } : {}),
      };

      if (exercise) {
        await updateExercise(exercise.id, data);
        addToast('Exercise updated', 'success');
        onSuccess ? onSuccess() : router.back();
      } else {
        await createExercise(data);
        addToast('Exercise created', 'success');
        router.back();
      }
    } catch (err) {
      console.error('Save failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to save exercise';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (showTrimmer && trimSource) {
    return (
      <VideoTrimmer
        videoFile={trimSource}
        onTrim={handleTrimComplete}
        onCancel={() => {
          setShowTrimmer(false);
          setTrimSource(null);
        }}
      />
    );
  }

  if (showUrlTrimmer && resolvedMediaUrl) {
    return (
      <ImportVideoTrimmer
        videoUrl={resolvedMediaUrl}
        onTrim={handleUrlTrimComplete}
        onCancel={() => setShowUrlTrimmer(false)}
      />
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Basics */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Basics
        </h2>
        <Input
        label="Exercise Name"
        placeholder="e.g., Push-ups"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        error={errors.name}
      />

      <Textarea
        label="Description"
        placeholder="How to perform this exercise, form cues..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Type & timing
        </h2>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-fg-muted">Type</label>
        <div className="flex rounded-xl bg-bg-elevated border border-border overflow-hidden">
          {(['repeat', 'timed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`
                flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${type === t ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-foreground'}
              `}
            >
              {t === 'repeat' ? <RepeatIcon size={16} /> : <TimerIcon size={16} />}
              {EXERCISE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Time Per Rep (only for repeat) */}
      {type === 'repeat' && (
        <Input
          label="Seconds per rep"
          type="number"
          placeholder="2"
          value={timePerRep}
          onChange={(e) => setTimePerRep(e.target.value)}
          error={errors.timePerRep}
          min={1}
        />
      )}

      {/* Two-sided toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-sm font-medium text-foreground">Two-sided</span>
          <p className="text-xs text-fg-muted">Add to routine for both left and right</p>
        </div>
        <button
          type="button"
          onClick={() => setTwoSided(!twoSided)}
          className={`
            relative shrink-0 w-12 h-6 rounded-full transition-colors overflow-visible
            ${twoSided ? 'bg-accent' : 'bg-bg-elevated border border-border'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
              ${twoSided ? 'translate-x-6' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Tags & privacy
        </h2>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-fg-muted">Tags</label>
        <ChipSelector
          selected={chips}
          onChange={setChips}
          chips={profile?.tags?.length ? profile.tags : EXERCISE_CHIPS}
          onAddTag={
            firebaseUser
              ? async (tag) => {
                  const current = profile?.tags ?? [...EXERCISE_CHIPS];
                  await updateUser(firebaseUser.uid, {
                    tags: [...current, tag],
                  });
                  await refreshProfile();
                }
              : undefined
          }
        />
      </div>

      {/* Privacy */}
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-fg-muted">Public exercise</span>
        <button
          type="button"
          onClick={() => setIsPublic(!isPublic)}
          className={`
            relative shrink-0 w-12 h-6 rounded-full transition-colors overflow-visible
            ${isPublic ? 'bg-accent' : 'bg-bg-elevated border border-border'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
              ${isPublic ? 'translate-x-6' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Media
        </h2>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-fg-muted">Media</label>

        {mediaPreview ? (
          <div className="relative rounded-xl overflow-hidden bg-bg-elevated aspect-[9/16] max-w-[200px] mx-auto">
            {mediaType === 'video' ? (
              <video
                src={mediaPreview}
                muted
                loop
                playsInline
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* For existing media: show tap to edit overlay */}
            {hasExistingMedia && mediaType === 'video' && (
              <button
                type="button"
                onClick={() => setShowMediaActions(true)}
                className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center group"
              >
                <span className="bg-white/90 text-black text-xs font-semibold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  Edit Video
                </span>
              </button>
            )}
            
            {/* For new media: show X button to remove */}
            {hasNewMedia && (
              <button
                type="button"
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview(resolvedMediaUrl || '');
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white text-sm hover:bg-black/80 transition-colors"
                aria-label="Remove new media"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[9/16] max-w-[200px] mx-auto rounded-xl border-2 border-dashed border-border hover:border-fg-subtle flex flex-col items-center justify-center gap-2 text-fg-muted transition-colors"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-xs">Upload video, GIF, or photo</span>
          </button>
        )}

        {errors.media && (
          <p className="text-xs text-danger">{errors.media}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      </section>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button
          fullWidth={!onCancel}
          className={onCancel ? 'flex-1' : ''}
          onClick={handleSave}
          loading={saving}
        >
          {exercise ? 'Save Changes' : 'Create Exercise'}
        </Button>
      </div>

      <ConfirmModal
        open={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={() => {
          setShowDiscardModal(false);
          onCancel?.();
        }}
        title="Discard changes?"
        message="Your edits will not be saved."
        confirmLabel="Discard"
        variant="danger"
      />

      {/* Video action sheet */}
      <BottomSheet
        open={showMediaActions}
        onClose={() => setShowMediaActions(false)}
        title="Edit Video"
      >
        <div className="p-4 space-y-2 pb-safe-b">
          <button
            type="button"
            onClick={() => {
              setShowMediaActions(false);
              fileInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-bg-elevated hover:bg-bg-elevated/80 transition-colors text-left"
          >
            <RefreshIcon size={20} className="text-fg-muted shrink-0" />
            <div>
              <p className="font-medium text-sm">Replace Video</p>
              <p className="text-xs text-fg-muted">Upload a new video to replace the current one</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMediaActions(false);
              setShowUrlTrimmer(true);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-bg-elevated hover:bg-bg-elevated/80 transition-colors text-left"
          >
            <ScissorsIcon size={20} className="text-fg-muted shrink-0" />
            <div>
              <p className="font-medium text-sm">Trim Video</p>
              <p className="text-xs text-fg-muted">Adjust start and end points of the clip</p>
            </div>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
