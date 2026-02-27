import { Timestamp } from 'firebase/firestore';

// ── User ──────────────────────────────────────────────────
export type ReferralSource = 'yair' | 'friend' | 'social_media' | 'other';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  referral_source: ReferralSource;
  referral_source_other?: string;
  preferences?: Record<string, unknown>;
  tags?: string[];
  analyzed_video_urls?: string[];
  admin?: boolean;
  createdAt: Timestamp;
}

// ── Exercise ──────────────────────────────────────────────
export type ExerciseType = 'repeat' | 'timed';
export type MediaType = 'video' | 'gif' | 'photo';

/** Display label for exercise type (חזרות = Reps) */
export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  repeat: 'Reps',
  timed: 'Timed',
};

export interface Exercise {
  id: string;
  author_id: string;
  name: string;
  description: string;
  type: ExerciseType;
  default_time_per_rep_secs?: number;
  media_url: string;
  media_type: MediaType;
  chips: string[];
  is_public: boolean;
  credit?: string;
  /** Storage path for resolving URL (used by imported exercises) */
  media_storage_path?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Routine Blocks ────────────────────────────────────────
export interface ExerciseBlock {
  id: string;
  type: 'exercise';
  exercise_id: string;
  exercise_name: string;
  exercise_description: string;
  media_url: string;
  media_type: MediaType;
  exercise_type: ExerciseType;
  duration_secs: number;
  reps?: number;
}

export interface BreakBlock {
  id: string;
  type: 'break';
  duration_secs: number;
}

export interface LoopBlock {
  id: string;
  type: 'loop';
  iterations: number;
  blocks: (ExerciseBlock | BreakBlock)[];
}

export type RoutineBlock = ExerciseBlock | BreakBlock | LoopBlock;

// ── Routine ───────────────────────────────────────────────
export interface Routine {
  id: string;
  name: string;
  blocks: RoutineBlock[];
  prep_time_secs: number;
  cooldown_time_secs: number;
  total_duration_secs: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Flattened Block (for player) ──────────────────────────
export interface FlatBlock {
  id: string;
  type: 'exercise' | 'break' | 'prep' | 'cooldown';
  exercise_id?: string;
  exercise_name?: string;
  exercise_description?: string;
  media_url?: string;
  media_type?: MediaType;
  exercise_type?: ExerciseType;
  duration_secs: number;
  reps?: number;
  originalBlockId: string;
  loopIteration?: number;
}

// ── Active Workout ────────────────────────────────────────
export interface Workout {
  id: string;
  routine_id: string;
  custom_name: string;
  state: 'active' | 'paused';
  last_active_timestamp: Timestamp;
  progress_index: number;
  current_block_remaining_secs: number;
  modifications: WorkoutModification[];
  skipped_blocks: number[];
}

export interface WorkoutModification {
  block_index: number;
  added_time: number;
}

// ── Completed Block ───────────────────────────────────────
export interface CompletedBlock {
  block_index: number;
  block_id: string;
  type: 'exercise' | 'break' | 'prep' | 'cooldown';
  exercise_id?: string;
  exercise_name?: string;
  planned_duration_secs: number;
  actual_duration_secs: number;
  skipped: boolean;
  time_added_secs: number;
}

// ── User Exercise Stats ───────────────────────────────────
export interface UserExerciseStats {
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  completions: number;
  skips: number;
  workouts_included: number;
  total_planned_duration_secs: number;
  total_actual_duration_secs: number;
  total_time_added_secs: number;
  avg_duration_secs: number;
  first_completed_at: Timestamp;
  last_completed_at: Timestamp;
  updated_at: Timestamp;
}

// ── Archive Entry ─────────────────────────────────────────
export type CompletionType = 'completed' | 'auto_completed';

export interface ArchiveEntry {
  id: string;
  workout_id: string;
  routine_id: string;
  routine_name: string;
  custom_name: string;
  completed_at: Timestamp;
  completion_type: CompletionType;
  total_duration_secs: number;
  blocks_completed: CompletedBlock[];
  modifications_applied: boolean;
  memory_media: MemoryMedia[];
  memory_media_paths: string[];
}

// ── Memory Media ──────────────────────────────────────────
export interface MemoryMedia {
  url: string;
  type: 'photo' | 'video';
}

// ── Chip Presets ──────────────────────────────────────────
export const EXERCISE_CHIPS = [
  'Core',
  'Arms',
  'Legs',
  'Cardio',
  'Stretch',
  'Balance',
  'Back',
  'Chest',
  'Shoulders',
  'Full Body',
] as const;

export type ExerciseChip = (typeof EXERCISE_CHIPS)[number];

// ── Duration Presets ──────────────────────────────────────
export const DURATION_PRESETS = [0, 5, 10, 15, 20, 30, 45, 60] as const;
export const BREAK_DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60] as const;

// ── Video Import Job ──────────────────────────────────────
export type VideoImportJobStatus =
  | 'created'
  | 'invoked'
  | 'v_downloaded'
  | 'analyzed'
  | 'await_approve'
  | 'incomplete_approve'
  | 'complete'
  | 'error'
  | 'rejected';

export type ImportExerciseItemStatus = 'pending' | 'approved' | 'removed';

export interface ImportExerciseItem {
  index: number;
  name: string;
  description: string;
  type: ExerciseType;
  default_time_per_rep_secs?: number;
  chips: string[];
  timestamp_start: number;
  timestamp_end: number;
  media_url?: string;
  status: ImportExerciseItemStatus;
  exercise_id?: string;
}

export interface InstagramMetadata {
  author?: { username?: string; full_name?: string; profile_url?: string };
  caption?: string;
  duration_seconds?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  hashtags?: string[];
  mentions?: string[];
  url?: string;
}

export interface VideoImportJob {
  id: string;
  user_id: string;
  instagram_url: string;
  status: VideoImportJobStatus;
  status_message?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  instagram_metadata?: InstagramMetadata;
  exercises: ImportExerciseItem[];
  storage_ref_full?: string;
  storage_ref_clips?: string[];
  ai_analysis_log_id?: string;
  /** True when user dismissed an error card (status stays 'error') */
  dismissed?: boolean;
}
