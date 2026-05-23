import { create } from 'zustand';
import type { Palette } from '../../constants/theme';
import type { Profile, Program, WorkoutLog } from '../database.types';

interface AppStore {
  // Auth
  userId: string | null;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;

  // Theme
  palette: Palette;
  setPalette: (p: Palette) => void;

  // Active program
  activeProgram: Program | null;
  setActiveProgram: (p: Program | null) => void;

  // Active workout
  activeWorkoutLog: WorkoutLog | null;
  setActiveWorkoutLog: (w: WorkoutLog | null) => void;
  workoutStartedAt: Date | null;
  setWorkoutStartedAt: (d: Date | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  userId: null,
  profile: null,
  setProfile: (profile) => set({ profile, userId: profile?.id ?? null }),

  palette: 'volt',
  setPalette: (palette) => set({ palette }),

  activeProgram: null,
  setActiveProgram: (activeProgram) => set({ activeProgram }),

  activeWorkoutLog: null,
  setActiveWorkoutLog: (activeWorkoutLog) => set({ activeWorkoutLog }),
  workoutStartedAt: null,
  setWorkoutStartedAt: (workoutStartedAt) => set({ workoutStartedAt }),
}));
