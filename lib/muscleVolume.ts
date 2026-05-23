// ============================================================
// MUSCLE VOLUME — weekly training volume per muscle, derived
// from real set_logs. "Volume" = effective working sets
// (the scientific weekly-set landmark used for MEV/MAV/MRV).
//
// Muscle attribution uses the EXERCISE_LIBRARY's *detailed*
// muscle list (resolved deterministically from the exercise
// UUID), so the analysis is precise (biceps / triceps / avant-
// bras instead of just "bras") and independent of DB seeding.
// ============================================================
import { supabase } from './supabase';
import { EXERCISE_LIBRARY } from '../constants/exercises';

// French muscle names → body-map muscle id (accent-insensitive).
const NAME_TO_ID: Record<string, string> = {
  'pectoral superieur': 'pec_upper',
  'pectoral moyen':     'pec_mid',
  'pectoraux':          'pec_mid',
  'pectoral inferieur': 'pec_lower',
  'deltoide anterieur': 'delt_front',
  'deltoide lateral':   'delt_side',
  'deltoide posterieur':'delt_rear',
  'trapezes':           'traps',
  'rhomboides':         'traps',
  'grand dorsal':       'lats',
  'lombaires':          'lower_back',
  'biceps':             'biceps',
  'triceps':            'triceps',
  'avant-bras':         'forearms',
  'avant bras':         'forearms',
  'abdo. superieur':    'abs_upper',
  'abdo superieur':     'abs_upper',
  'abdominaux sup.':    'abs_upper',
  'abdominaux superieur':'abs_upper',
  'abdo. inferieur':    'abs_lower',
  'abdo inferieur':     'abs_lower',
  'abdominaux inf.':    'abs_lower',
  'abdominaux inferieur':'abs_lower',
  'obliques':           'obliques',
  'quadriceps':         'quads',
  'fessiers':           'glutes',
  'ischio-jambiers':    'hamstrings',
  'ischio jambiers':    'hamstrings',
  'mollets':            'calves',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .trim();
}

export function muscleNameToId(name: string): string | null {
  return NAME_TO_ID[normalize(name)] ?? null;
}

// Deterministic exercise UUID (matches the seed in supabase/seed.sql
// and exIdToUUID used across the app) → EXERCISE_LIBRARY entry.
export const UUID_TO_LIB = new Map<string, (typeof EXERCISE_LIBRARY)[number]>();
EXERCISE_LIBRARY.forEach((ex, idx) => {
  const uuid = `00000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
  UUID_TO_LIB.set(uuid, ex);
});

/** Résout un UUID d'exercice en nom lisible (ou fallback générique). */
export function exerciseNameFromUuid(uuid: string): string {
  return UUID_TO_LIB.get(uuid)?.name ?? 'Exercice personnalisé';
}

/** Résout un UUID d'exercice en groupe musculaire (ou '—'). */
export function exerciseMuscleGroupFromUuid(uuid: string): string {
  return UUID_TO_LIB.get(uuid)?.muscleGroup ?? '—';
}

// Monday (local) of the week containing `d`, as YYYY-MM-DD
export function weekStartStr(d = new Date()): string {
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return monday.toISOString().split('T')[0];
}

export type VolumeMap = Record<string, number>; // muscle_id → percentage (0-100)

/**
 * Aggregate the last 7 days of completed sets into per-muscle
 * effective-set counts, then persist as percentages for the
 * current week in muscle_volume_weeks.
 */
export async function computeAndStoreWeeklyVolume(userId: string): Promise<VolumeMap> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: rows } = await supabase
    .from('set_logs')
    .select('exercise_id, completed_at, workout_logs!inner(user_id)')
    .eq('workout_logs.user_id', userId)
    .gte('completed_at', since);

  const setsByMuscle: Record<string, number> = {};
  for (const r of (rows ?? []) as any[]) {
    const lib = UUID_TO_LIB.get(r.exercise_id);
    const muscles: string[] = lib?.muscles ?? [];
    muscles.forEach((m, idx) => {
      const id = muscleNameToId(m);
      if (!id) return;
      // Primary mover (first listed) counts fully, synergists half.
      setsByMuscle[id] = (setsByMuscle[id] ?? 0) + (idx === 0 ? 1 : 0.5);
    });
  }

  const total = Object.values(setsByMuscle).reduce((a, b) => a + b, 0);
  const volumeMap: VolumeMap = {};
  if (total > 0) {
    for (const [id, sets] of Object.entries(setsByMuscle)) {
      volumeMap[id] = Math.round((sets / total) * 1000) / 10; // 1 decimal
    }
  }

  const ws = weekStartStr();
  const upsertRows = Object.entries(volumeMap).map(([muscle_id, volume_pct]) => ({
    user_id: userId, week_start: ws, muscle_id, volume_pct,
  }));
  if (upsertRows.length > 0) {
    await supabase
      .from('muscle_volume_weeks')
      .upsert(upsertRows as any, { onConflict: 'user_id,week_start,muscle_id' });
  }

  return volumeMap;
}

/**
 * Load the most recent stored weekly volume for display.
 * Falls back to a live computation if nothing is stored yet.
 */
export async function loadWeeklyVolume(userId: string): Promise<VolumeMap> {
  // Always recompute live so the analysis stays precise & fresh.
  return computeAndStoreWeeklyVolume(userId);
}
