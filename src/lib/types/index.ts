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
  createdAt: Timestamp;
}

// ── Exercise ──────────────────────────────────────────────
export type ExerciseType = 'repeat' | 'timed';
export type MediaType = 'video' | 'gif' | 'photo';

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
