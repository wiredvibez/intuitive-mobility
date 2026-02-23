'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import { createExercise, updateExercise } from '@/lib/firebase/firestore';
import { uploadExerciseMedia } from '@/lib/firebase/storage';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChipSelector } from './ChipSelector';
import { VideoTrimmer } from './VideoTrimmer';
import {
  validateExerciseName,
  getMediaTypeFromFile,
  isVideoFile,
  getVideoDuration,
  ACCEPTED_MEDIA_TYPES,
  MAX_VIDEO_DURATION_SECS,
} from '@/lib/utils/validators';
import type { Exercise, ExerciseType, MediaType } from '@/lib/types';

interface ExerciseFormProps {
  exercise?: Exercise;
}

export function ExerciseForm({ exercise }: ExerciseFormProps) {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(exercise?.name || '');
  const [description, setDescription] = useState(exercise?.description || '');
  const [type, setType] = useState<ExerciseType>(exercise?.type || 'repeat');
  const [timePerRep, setTimePerRep] = useState(
    exercise?.default_time_per_rep_secs?.toString() || '2'
  );
  const [chips, setChips] = useState<string[]>(exercise?.chips || []);
  const [isPublic, setIsPublic] = useState(exercise?.is_public ?? false);
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaPreview, setMediaPreview] = useState(exercise?.media_url || '');
  const [mediaType, setMediaType] = useState<MediaType>(
    exercise?.media_type || 'video'
  );
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [trimSource, setTrimSource] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isVideoFile(file)) {
      try {
        const dur = await getVideoDuration(file);
        if (dur > MAX_VIDEO_DURATION_SECS) {
          setTrimSource(file);
          setShowTrimmer(true);
          return;
        }
      } catch {
        // proceed anyway
      }
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
    if (!validate() || !firebaseUser) return;
    setSaving(true);

    try {
      let finalMediaUrl = exercise?.media_url || '';
      const exerciseId = exercise?.id || Date.now().toString(36);

      if (mediaFile) {
        const upload = await uploadExerciseMedia(
          firebaseUser.uid,
          mediaFile instanceof File ? mediaFile : new File([mediaFile], 'trimmed.webm'),
          exerciseId
        );
        finalMediaUrl = upload.url;
      }

      const data = {
        author_id: firebaseUser.uid,
        name: name.trim(),
        description: description.trim(),
        type,
        default_time_per_rep_secs: type === 'repeat' ? parseInt(timePerRep) : undefined,
        media_url: finalMediaUrl,
        media_type: mediaType,
        chips,
        is_public: isPublic,
      };

      if (exercise) {
        await updateExercise(exercise.id, data);
        addToast('Exercise updated', 'success');
      } else {
        await createExercise(data);
        addToast('Exercise created', 'success');
      }

      router.back();
    } catch (err) {
      console.error('Save failed:', err);
      addToast('Failed to save exercise', 'error');
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

  return (
    <div className="space-y-5 p-4">
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

      {/* Type Toggle */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-fg-muted">Type</label>
        <div className="flex rounded-xl bg-bg-elevated border border-border overflow-hidden">
          {(['repeat', 'timed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`
                flex-1 py-2.5 text-sm font-medium transition-colors
                ${type === t ? 'bg-accent text-white' : 'text-fg-muted hover:text-foreground'}
              `}
            >
              {t === 'repeat' ? '⟳ Repeat' : '⏱ Timed'}
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

      {/* Chips */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-fg-muted">Tags</label>
        <ChipSelector selected={chips} onChange={setChips} />
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

      {/* Media Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-fg-muted">Media</label>

        {mediaPreview ? (
          <div className="relative rounded-xl overflow-hidden bg-bg-elevated aspect-video">
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
            <button
              onClick={() => {
                setMediaFile(null);
                setMediaPreview('');
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-fg-subtle flex flex-col items-center justify-center gap-2 text-fg-muted transition-colors"
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

      <Button fullWidth onClick={handleSave} loading={saving}>
        {exercise ? 'Save Changes' : 'Create Exercise'}
      </Button>
    </div>
  );
}
