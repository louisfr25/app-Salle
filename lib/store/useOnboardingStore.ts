import { create } from 'zustand';

export interface OnboardingData {
  // Étape 1 — Identité
  full_name: string;
  username: string;
  birth_date: string;
  gender: 'male' | 'female' | 'other' | '';

  // Étape 2 — Objectif
  goal: 'muscle' | 'strength' | 'weight_loss' | 'endurance' | 'general' | '';

  // Étape 3 — Niveau & morpho
  level: 'beginner' | 'intermediate' | 'advanced' | '';
  height_cm: string;
  weight_kg: string;

  // Étape 4 — Programme
  days_per_week: number;
  program_source: 'ai' | 'manual';
}

interface OnboardingStore {
  data: OnboardingData;
  set: (partial: Partial<OnboardingData>) => void;
  reset: () => void;
}

const DEFAULT: OnboardingData = {
  full_name: '',
  username: '',
  birth_date: '',
  gender: '',
  goal: '',
  level: '',
  height_cm: '',
  weight_kg: '',
  days_per_week: 3,
  program_source: 'ai',
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  data: { ...DEFAULT },
  set: (partial) => set((s) => ({ data: { ...s.data, ...partial } })),
  reset: () => set({ data: { ...DEFAULT } }),
}));
