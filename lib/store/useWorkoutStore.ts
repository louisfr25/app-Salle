import { create } from 'zustand';
import type { SessionExercise } from '../database.types';

export interface ActiveSet {
  setIndex: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
  isResting: boolean;
}

export interface ActiveExercise {
  sessionExercise: SessionExercise;
  exerciseName: string;
  sets: ActiveSet[];
  previousSets?: { reps: number; weight: number }[];
}

interface WorkoutStore {
  exercises: ActiveExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  restSeconds: number;
  isResting: boolean;
  elapsedSeconds: number;

  setExercises: (ex: ActiveExercise[]) => void;
  addExercise: (ex: ActiveExercise) => void;
  goToExercise: (i: number) => void;
  goToSet: (i: number) => void;
  setExerciseRest: (exerciseIdx: number, seconds: number) => void;
  updateSet: (exerciseIdx: number, setIdx: number, data: Partial<ActiveSet>) => void;
  completeSet: (exerciseIdx: number, setIdx: number) => void;
  startRest: (seconds: number) => void;
  stopRest: () => void;
  setElapsed: (s: number) => void;
  reset: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  exercises: [],
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  restSeconds: 0,
  isResting: false,
  elapsedSeconds: 0,

  setExercises: (exercises) => set({ exercises, currentExerciseIndex: 0, currentSetIndex: 0 }),
  addExercise: (ex) =>
    set((state) => ({
      exercises: [...state.exercises, ex],
      currentExerciseIndex: state.exercises.length, // jump to the new one
      currentSetIndex: 0,
    })),
  goToExercise: (i) => set({ currentExerciseIndex: i, currentSetIndex: 0 }),
  goToSet: (i) => set({ currentSetIndex: i }),

  setExerciseRest: (exerciseIdx, seconds) =>
    set((state) => {
      const exercises = [...state.exercises];
      const ex = exercises[exerciseIdx];
      if (!ex) return {};
      const clamped = Math.max(15, Math.min(600, seconds));
      exercises[exerciseIdx] = {
        ...ex,
        sessionExercise: { ...ex.sessionExercise, rest_seconds: clamped },
      };
      return { exercises };
    }),

  updateSet: (exerciseIdx, setIdx, data) =>
    set((state) => {
      const exercises = [...state.exercises];
      const sets = [...exercises[exerciseIdx].sets];
      sets[setIdx] = { ...sets[setIdx], ...data };
      exercises[exerciseIdx] = { ...exercises[exerciseIdx], sets };
      return { exercises };
    }),

  completeSet: (exerciseIdx, setIdx) => {
    get().updateSet(exerciseIdx, setIdx, { completed: true });
    const { exercises, currentExerciseIndex } = get();
    const ex = exercises[exerciseIdx];
    const nextSet = setIdx + 1;
    if (nextSet < ex.sets.length) {
      set({ currentSetIndex: nextSet });
    } else if (exerciseIdx + 1 < exercises.length) {
      set({ currentExerciseIndex: exerciseIdx + 1, currentSetIndex: 0 });
    }
  },

  startRest: (seconds) => set({ isResting: true, restSeconds: seconds }),
  stopRest: () => set({ isResting: false, restSeconds: 0 }),
  setElapsed: (s) => set({ elapsedSeconds: s }),

  reset: () => set({
    exercises: [],
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    restSeconds: 0,
    isResting: false,
    elapsedSeconds: 0,
  }),
}));
