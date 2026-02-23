import { create } from 'zustand';
import type {
  FlatBlock,
  RoutineBlock,
  ExerciseBlock,
  BreakBlock,
  LoopBlock,
  WorkoutModification,
  CompletedBlock,
} from '../types';

interface PlayerState {
  // Core state
  blocks: FlatBlock[];
  currentBlockIndex: number;
  remainingSeconds: number;
  isPlaying: boolean;
  workoutId: string | null;
  routineId: string | null;
  routineName: string;

  // Tracking
  modifications: WorkoutModification[];
  skippedBlocks: number[];
  completedBlocks: CompletedBlock[];
  blockStartTime: number; // timestamp when current block started

  // Actions
  initPlayer: (params: {
    blocks: FlatBlock[];
    workoutId: string;
    routineId: string;
    routineName: string;
    startIndex?: number;
    startRemaining?: number;
  }) => void;
  play: () => void;
  pause: () => void;
  skip: () => void;
  addTime: (secs: number) => void;
  tick: () => boolean; // returns true if workout is complete
  resetPlayer: () => void;

  // Computed helpers
  getCurrentBlock: () => FlatBlock | null;
  getNextBlocks: (count: number) => FlatBlock[];
  getProgress: () => number;
  getTotalBlocks: () => number;
}

/** Flatten routine blocks (expanding loops) into a sequential list */
export function flattenBlocks(
  blocks: RoutineBlock[],
  prepTimeSecs: number,
  cooldownTimeSecs: number
): FlatBlock[] {
  const flat: FlatBlock[] = [];

  // Prep block
  if (prepTimeSecs > 0) {
    flat.push({
      id: 'prep',
      type: 'prep',
      duration_secs: prepTimeSecs,
      originalBlockId: 'prep',
    });
  }

  const processBlock = (block: RoutineBlock) => {
    if (block.type === 'exercise') {
      const ex = block as ExerciseBlock;
      flat.push({
        id: ex.id,
        type: 'exercise',
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name,
        exercise_description: ex.exercise_description,
        media_url: ex.media_url,
        media_type: ex.media_type,
        exercise_type: ex.exercise_type,
        duration_secs: ex.duration_secs,
        reps: ex.reps,
        originalBlockId: ex.id,
      });
    } else if (block.type === 'break') {
      const br = block as BreakBlock;
      flat.push({
        id: br.id,
        type: 'break',
        duration_secs: br.duration_secs,
        originalBlockId: br.id,
      });
    } else if (block.type === 'loop') {
      const loop = block as LoopBlock;
      for (let i = 0; i < loop.iterations; i++) {
        for (const innerBlock of loop.blocks) {
          const flatBlock = { ...innerBlock };
          if (flatBlock.type === 'exercise') {
            const ex = flatBlock as ExerciseBlock;
            flat.push({
              id: `${ex.id}_loop${i}`,
              type: 'exercise',
              exercise_id: ex.exercise_id,
              exercise_name: ex.exercise_name,
              exercise_description: ex.exercise_description,
              media_url: ex.media_url,
              media_type: ex.media_type,
              exercise_type: ex.exercise_type,
              duration_secs: ex.duration_secs,
              reps: ex.reps,
              originalBlockId: ex.id,
              loopIteration: i,
            });
          } else {
            const br = flatBlock as BreakBlock;
            flat.push({
              id: `${br.id}_loop${i}`,
              type: 'break',
              duration_secs: br.duration_secs,
              originalBlockId: br.id,
              loopIteration: i,
            });
          }
        }
      }
    }
  };

  for (const block of blocks) {
    processBlock(block);
  }

  // Cooldown block
  if (cooldownTimeSecs > 0) {
    flat.push({
      id: 'cooldown',
      type: 'cooldown',
      duration_secs: cooldownTimeSecs,
      originalBlockId: 'cooldown',
    });
  }

  return flat;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  blocks: [],
  currentBlockIndex: 0,
  remainingSeconds: 0,
  isPlaying: false,
  workoutId: null,
  routineId: null,
  routineName: '',
  modifications: [],
  skippedBlocks: [],
  completedBlocks: [],
  blockStartTime: 0,

  initPlayer: ({ blocks, workoutId, routineId, routineName, startIndex = 0, startRemaining }) => {
    set({
      blocks,
      currentBlockIndex: startIndex,
      remainingSeconds: startRemaining ?? blocks[startIndex]?.duration_secs ?? 0,
      isPlaying: false,
      workoutId,
      routineId,
      routineName,
      modifications: [],
      skippedBlocks: [],
      completedBlocks: [],
      blockStartTime: Date.now(),
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  skip: () => {
    const state = get();
    const { currentBlockIndex, blocks } = state;
    const currentBlock = blocks[currentBlockIndex];

    if (!currentBlock) return;

    // Log as skipped
    const completed: CompletedBlock = {
      block_index: currentBlockIndex,
      block_id: currentBlock.id,
      type: currentBlock.type,
      exercise_id: currentBlock.exercise_id,
      exercise_name: currentBlock.exercise_name,
      planned_duration_secs: currentBlock.duration_secs,
      actual_duration_secs: 0,
      skipped: true,
      time_added_secs: 0,
    };

    const nextIndex = currentBlockIndex + 1;
    if (nextIndex >= blocks.length) {
      set((s) => ({
        isPlaying: false,
        skippedBlocks: [...s.skippedBlocks, currentBlockIndex],
        completedBlocks: [...s.completedBlocks, completed],
        currentBlockIndex: nextIndex,
      }));
    } else {
      set((s) => ({
        currentBlockIndex: nextIndex,
        remainingSeconds: blocks[nextIndex].duration_secs,
        skippedBlocks: [...s.skippedBlocks, currentBlockIndex],
        completedBlocks: [...s.completedBlocks, completed],
        blockStartTime: Date.now(),
      }));
    }
  },

  addTime: (secs) => {
    const state = get();
    set((s) => ({
      remainingSeconds: s.remainingSeconds + secs,
      modifications: [
        ...s.modifications,
        { block_index: state.currentBlockIndex, added_time: secs },
      ],
    }));
  },

  tick: () => {
    const state = get();
    if (!state.isPlaying || state.remainingSeconds <= 0) return false;

    const newRemaining = state.remainingSeconds - 1;

    if (newRemaining <= 0) {
      // Block complete
      const currentBlock = state.blocks[state.currentBlockIndex];
      const addedTime = state.modifications
        .filter((m) => m.block_index === state.currentBlockIndex)
        .reduce((sum, m) => sum + m.added_time, 0);

      const completed: CompletedBlock = {
        block_index: state.currentBlockIndex,
        block_id: currentBlock?.id || '',
        type: currentBlock?.type || 'exercise',
        exercise_id: currentBlock?.exercise_id,
        exercise_name: currentBlock?.exercise_name,
        planned_duration_secs: currentBlock?.duration_secs || 0,
        actual_duration_secs: (currentBlock?.duration_secs || 0) + addedTime,
        skipped: false,
        time_added_secs: addedTime,
      };

      const nextIndex = state.currentBlockIndex + 1;
      if (nextIndex >= state.blocks.length) {
        // Workout complete
        set((s) => ({
          isPlaying: false,
          completedBlocks: [...s.completedBlocks, completed],
          currentBlockIndex: nextIndex,
          remainingSeconds: 0,
        }));
        return true;
      }

      set((s) => ({
        currentBlockIndex: nextIndex,
        remainingSeconds: state.blocks[nextIndex].duration_secs,
        completedBlocks: [...s.completedBlocks, completed],
        blockStartTime: Date.now(),
      }));
      return false;
    }

    set({ remainingSeconds: newRemaining });
    return false;
  },

  resetPlayer: () =>
    set({
      blocks: [],
      currentBlockIndex: 0,
      remainingSeconds: 0,
      isPlaying: false,
      workoutId: null,
      routineId: null,
      routineName: '',
      modifications: [],
      skippedBlocks: [],
      completedBlocks: [],
      blockStartTime: 0,
    }),

  getCurrentBlock: () => {
    const { blocks, currentBlockIndex } = get();
    return blocks[currentBlockIndex] || null;
  },

  getNextBlocks: (count) => {
    const { blocks, currentBlockIndex } = get();
    return blocks.slice(currentBlockIndex + 1, currentBlockIndex + 1 + count);
  },

  getProgress: () => {
    const { blocks, currentBlockIndex } = get();
    if (blocks.length === 0) return 0;
    return (currentBlockIndex / blocks.length) * 100;
  },

  getTotalBlocks: () => get().blocks.length,
}));
