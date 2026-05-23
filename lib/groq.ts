/**
 * Génération de programme par IA.
 *
 * SÉCURITÉ : l'appel à Groq se fait désormais côté serveur via la
 * Supabase Edge Function `groq-program`. La clé API Groq n'est PLUS
 * embarquée dans le bundle client (elle était auparavant exposée via
 * EXPO_PUBLIC_GROQ_API_KEY et extractible par n'importe quel utilisateur).
 *
 * Déploiement requis (une fois) :
 *   supabase functions deploy groq-program
 *   supabase secrets set GROQ_API_KEY=gsk_xxx
 */
import { supabase } from './supabase';

export interface AIGeneratedProgram {
  name: string;
  sessions: {
    name: string;
    exercises: {
      exercise_id: string;
      sets: number;
      reps: number;
      rest_seconds: number;
    }[];
  }[];
}

export async function generateProgramWithGroq(params: {
  goal: string;
  level: string;
  daysPerWeek: number;
  gender?: string | null;
  availableExerciseIds: string[];
}): Promise<AIGeneratedProgram> {
  // invoke() attache automatiquement le JWT de l'utilisateur connecté.
  const { data, error } = await supabase.functions.invoke('groq-program', {
    body: {
      goal: params.goal,
      level: params.level,
      daysPerWeek: params.daysPerWeek,
      gender: params.gender ?? null,
      availableExerciseIds: params.availableExerciseIds,
    },
  });

  if (error) {
    throw new Error("La génération du programme a échoué. Réessaie plus tard.");
  }

  const parsed = data as AIGeneratedProgram;
  if (!parsed?.name || !Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
    throw new Error('Structure du programme invalide — réessaie');
  }

  // Défense en profondeur : on re-filtre côté client également.
  const allow = new Set(params.availableExerciseIds);
  parsed.sessions = parsed.sessions.map((sess) => ({
    ...sess,
    exercises: (sess.exercises ?? []).filter((ex) => allow.has(ex.exercise_id)),
  }));

  return parsed;
}
