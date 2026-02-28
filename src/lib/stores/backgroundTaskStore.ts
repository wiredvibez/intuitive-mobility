import { create } from 'zustand';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  type: 'routine_save' | 'video_trim' | 'workout_save' | 'exercise_save';
  status: TaskStatus;
  message: string;
  progress?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

interface BackgroundTaskState {
  tasks: Map<string, BackgroundTask>;
  addTask: (task: Omit<BackgroundTask, 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (id: string) => void;
  getActiveTasks: () => BackgroundTask[];
  hasActiveTask: (type: BackgroundTask['type']) => boolean;
}

export const useBackgroundTaskStore = create<BackgroundTaskState>((set, get) => ({
  tasks: new Map(),

  addTask: (task) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(task.id, {
        ...task,
        createdAt: Date.now(),
      });
      return { tasks: newTasks };
    });
  },

  updateTask: (id, updates) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      const existing = newTasks.get(id);
      if (existing) {
        newTasks.set(id, { ...existing, ...updates });
      }
      return { tasks: newTasks };
    });
  },

  removeTask: (id) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.delete(id);
      return { tasks: newTasks };
    });
  },

  getActiveTasks: () => {
    const tasks = get().tasks;
    return Array.from(tasks.values()).filter(
      (t) => t.status === 'pending' || t.status === 'running'
    );
  },

  hasActiveTask: (type) => {
    const tasks = get().tasks;
    return Array.from(tasks.values()).some(
      (t) => t.type === type && (t.status === 'pending' || t.status === 'running')
    );
  },
}));

export async function runBackgroundTask<T>(
  task: Omit<BackgroundTask, 'createdAt' | 'status'>,
  fn: () => Promise<T>,
  onSuccess?: (result: T) => void,
  onError?: (error: Error) => void
): Promise<T | null> {
  const { addTask, updateTask, removeTask } = useBackgroundTaskStore.getState();

  addTask({ ...task, status: 'running' });

  try {
    const result = await fn();
    updateTask(task.id, {
      status: 'completed',
      completedAt: Date.now(),
    });

    // Auto-remove completed tasks after 3 seconds
    setTimeout(() => removeTask(task.id), 3000);

    onSuccess?.(result);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    updateTask(task.id, {
      status: 'failed',
      error: error.message,
      completedAt: Date.now(),
    });

    // Auto-remove failed tasks after 5 seconds
    setTimeout(() => removeTask(task.id), 5000);

    onError?.(error);
    return null;
  }
}
