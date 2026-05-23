// ============================================================
// GAMIFICATION — XP, streaks, PRs, achievements
// Central logic called when a workout is completed.
// ============================================================
import { supabase } from './supabase';
import { computeAndStoreWeeklyVolume } from './muscleVolume';

// ── XP rules ─────────────────────────────────────────────────
const XP_PER_WORKOUT = 50;
const XP_PER_SET = 3;
const XP_PER_PR = 100;

// Epley 1RM estimate
export function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ── Achievement catalogue (codes must match the achievements table) ──
export interface AchievementDef {
  code: string;
  check: (s: AchievementStats) => boolean;
}

interface AchievementStats {
  totalWorkouts: number;
  streakDays: number;
  totalPRs: number;
  totalTonnage: number;       // cumulative kg lifted (all-time)
  workoutHour: number;        // hour the just-finished workout started
  workoutWeekday: number;     // 0=Sun … 6=Sat
  profileComplete: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_workout',   check: (s) => s.totalWorkouts >= 1 },
  { code: 'workouts_10',     check: (s) => s.totalWorkouts >= 10 },
  { code: 'workouts_25',     check: (s) => s.totalWorkouts >= 25 },
  { code: 'workouts_50',     check: (s) => s.totalWorkouts >= 50 },
  { code: 'workouts_100',    check: (s) => s.totalWorkouts >= 100 },
  { code: 'streak_3',        check: (s) => s.streakDays >= 3 },
  { code: 'streak_7',        check: (s) => s.streakDays >= 7 },
  { code: 'streak_14',       check: (s) => s.streakDays >= 14 },
  { code: 'streak_30',       check: (s) => s.streakDays >= 30 },
  { code: 'first_pr',        check: (s) => s.totalPRs >= 1 },
  { code: 'pr_10',           check: (s) => s.totalPRs >= 10 },
  { code: 'pr_25',           check: (s) => s.totalPRs >= 25 },
  { code: 'volume_5k',       check: (s) => s.totalTonnage >= 5000 },
  { code: 'volume_25k',      check: (s) => s.totalTonnage >= 25000 },
  { code: 'volume_100k',     check: (s) => s.totalTonnage >= 100000 },
  { code: 'early_bird',      check: (s) => s.workoutHour < 6 },
  { code: 'night_owl',       check: (s) => s.workoutHour >= 22 },
  { code: 'weekend_warrior', check: (s) => s.workoutWeekday === 0 || s.workoutWeekday === 6 },
  { code: 'complete_profile',check: (s) => s.profileComplete },
];

export interface WorkoutResult {
  xpEarned: number;
  newPRs: { exerciseName: string; weight: number; reps: number }[];
  newAchievements: { name: string; icon: string; xpReward: number; rarity: string }[];
  streakDays: number;
  totalXp: number;
}

function dateStr(d: Date) { return d.toISOString().split('T')[0]; }

// ── Main entry point ─────────────────────────────────────────
export async function finalizeWorkout(
  userId: string,
  workoutLogId: string,
): Promise<WorkoutResult> {
  const result: WorkoutResult = {
    xpEarned: 0, newPRs: [], newAchievements: [], streakDays: 0, totalXp: 0,
  };

  // 1. Load sets of this workout (+ exercise names)
  const { data: sets } = await supabase
    .from('set_logs')
    .select('id, exercise_id, reps, weight_kg, set_index, exercises(name)')
    .eq('workout_log_id', workoutLogId);

  const setRows = sets ?? [];

  // 2. Load the workout log (for started_at)
  const { data: log } = await supabase
    .from('workout_logs')
    .select('started_at')
    .eq('id', workoutLogId)
    .single();
  const startedAt = log?.started_at ? new Date(log.started_at) : new Date();

  // 3. Base XP
  let xp = XP_PER_WORKOUT + setRows.length * XP_PER_SET;

  // 4. PR detection — best estimated 1RM per exercise in this session
  const bestByExercise: Record<string, { weight: number; reps: number; oneRM: number; setId: string; name: string }> = {};
  for (const s of setRows as any[]) {
    if (s.weight_kg == null || s.reps == null || s.weight_kg <= 0) continue;
    const oneRM = estimateOneRM(s.weight_kg, s.reps);
    const prev = bestByExercise[s.exercise_id];
    if (!prev || oneRM > prev.oneRM) {
      bestByExercise[s.exercise_id] = {
        weight: s.weight_kg, reps: s.reps, oneRM, setId: s.id,
        name: s.exercises?.name ?? 'Exercice',
      };
    }
  }

  for (const [exerciseId, best] of Object.entries(bestByExercise)) {
    const { data: existingPR } = await supabase
      .from('personal_records')
      .select('id, one_rm_kg')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    const isNewPR = !existingPR || best.oneRM > (existingPR.one_rm_kg ?? 0);
    if (isNewPR) {
      await supabase.from('personal_records').upsert({
        user_id: userId,
        exercise_id: exerciseId,
        weight_kg: best.weight,
        reps: best.reps,
        one_rm_kg: best.oneRM,
        set_log_id: best.setId,
        achieved_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,exercise_id' });

      await supabase.from('set_logs').update({ is_pr: true }).eq('id', best.setId);

      xp += XP_PER_PR;
      result.newPRs.push({ exerciseName: best.name, weight: best.weight, reps: best.reps });
    }
  }

  // 5. Streak
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, streak_days, last_workout, full_name, weight_kg, height_cm, goal')
    .eq('id', userId)
    .single();

  const today = dateStr(new Date());
  const yesterday = dateStr(new Date(Date.now() - 86400000));
  let streak = profile?.streak_days ?? 0;
  if (profile?.last_workout === today) {
    // already counted today — keep streak
    streak = Math.max(streak, 1);
  } else if (profile?.last_workout === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  // 6. Persist XP + streak on profile
  const newTotalXp = (profile?.xp ?? 0) + xp;
  await supabase
    .from('profiles')
    .update({ xp: newTotalXp, streak_days: streak, last_workout: today })
    .eq('id', userId);

  result.xpEarned = xp;
  result.streakDays = streak;
  result.totalXp = newTotalXp;

  // 7. Tag xp_earned on the workout log
  await supabase.from('workout_logs').update({ xp_earned: xp }).eq('id', workoutLogId);

  // 8. Achievement stats
  const [{ count: workoutCount }, { count: prCount }, { data: allSets }, { data: alreadyUnlocked }] =
    await Promise.all([
      supabase.from('workout_logs').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).not('ended_at', 'is', null),
      supabase.from('personal_records').select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase.from('set_logs').select('reps, weight_kg, workout_log_id, workout_logs!inner(user_id)')
        .eq('workout_logs.user_id', userId),
      supabase.from('user_achievements').select('achievement_id, achievements(code)')
        .eq('user_id', userId),
    ]);

  const totalTonnage = (allSets ?? []).reduce(
    (sum: number, s: any) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0,
  );

  const profileComplete = !!(
    profile?.full_name && profile?.weight_kg && profile?.height_cm && profile?.goal
  );

  const stats: AchievementStats = {
    totalWorkouts: workoutCount ?? 0,
    streakDays: streak,
    totalPRs: prCount ?? 0,
    totalTonnage,
    workoutHour: startedAt.getHours(),
    workoutWeekday: startedAt.getDay(),
    profileComplete,
  };

  const unlockedCodes = new Set(
    (alreadyUnlocked ?? []).map((u: any) => u.achievements?.code).filter(Boolean),
  );

  const toUnlock = ACHIEVEMENTS.filter(
    (a) => !unlockedCodes.has(a.code) && a.check(stats),
  );

  if (toUnlock.length > 0) {
    const { data: defs } = await supabase
      .from('achievements')
      .select('id, code, name, icon, xp_reward, rarity')
      .in('code', toUnlock.map((a) => a.code));

    let bonusXp = 0;
    const rows: any[] = [];
    for (const def of defs ?? []) {
      rows.push({ user_id: userId, achievement_id: def.id, earned_at: new Date().toISOString() });
      bonusXp += def.xp_reward ?? 0;
      result.newAchievements.push({
        name: def.name, icon: def.icon ?? '🏅',
        xpReward: def.xp_reward ?? 0, rarity: def.rarity ?? 'common',
      });
    }
    if (rows.length > 0) {
      await supabase.from('user_achievements').insert(rows);
      if (bonusXp > 0) {
        const finalXp = newTotalXp + bonusXp;
        await supabase.from('profiles').update({ xp: finalXp }).eq('id', userId);
        result.xpEarned += bonusXp;
        result.totalXp = finalXp;
      }
    }
  }

  // 9. Refresh weekly muscle volume (non-blocking failure)
  try {
    await computeAndStoreWeeklyVolume(userId);
  } catch {
    // ignore — volume is best-effort
  }

  return result;
}
