/**
 * Historique visuel des séances
 * Feed groupé par semaine avec volume, exercices, PRs, durée
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SetEntry {
  reps: number | null;
  weight_kg: number | null;
  is_pr: boolean;
  exercise_id: string;
  exercises: { name: string } | null;
}

interface WorkoutEntry {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  xp_earned: number;
  program_sessions: { name: string } | null;
  set_logs: SetEntry[];
  // Computed
  sessionName: string;
  totalVolume: number;
  prCount: number;
  exerciseNames: string[];
}

interface WeekGroup {
  label: string;      // "Cette semaine", "Il y a 2 semaines"…
  dateRange: string;  // "12–18 mai"
  workouts: WorkoutEntry[];
  totalVolume: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

function fmtVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

function getMondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = (c.getDay() + 6) % 7; // 0=Lun
  c.setDate(c.getDate() - dow);
  c.setHours(0, 0, 0, 0);
  return c;
}

function weekLabel(monday: Date): string {
  const thisMonday  = getMondayOf(new Date());
  const diffMs      = thisMonday.getTime() - monday.getTime();
  const diffWeeks   = Math.round(diffMs / (7 * 86400_000));
  if (diffWeeks === 0) return 'Cette semaine';
  if (diffWeeks === 1) return 'La semaine dernière';
  return `Il y a ${diffWeeks} semaines`;
}

function weekDateRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('fr-FR', opts)} – ${sunday.toLocaleDateString('fr-FR', opts)}`;
}

function groupByWeek(workouts: WorkoutEntry[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();

  for (const w of workouts) {
    const d      = new Date(w.started_at);
    const monday = getMondayOf(d);
    const key    = monday.toISOString().split('T')[0];

    if (!map.has(key)) {
      map.set(key, {
        label:       weekLabel(monday),
        dateRange:   weekDateRange(monday),
        workouts:    [],
        totalVolume: 0,
      });
    }
    const g = map.get(key)!;
    g.workouts.push(w);
    g.totalVolume += w.totalVolume;
  }

  return Array.from(map.values());
}

// ── Carte séance ──────────────────────────────────────────────────────────────
function WorkoutCard({
  workout, colors, onPress,
}: {
  workout: WorkoutEntry;
  colors: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const date = new Date(workout.started_at);
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.surface, borderRadius: 16,
        padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12,
      }}
    >
      {/* Date + nom */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
            {workout.sessionName}
          </Text>
          <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>
            {dateStr} · {timeStr}
          </Text>
        </View>
        {workout.prCount > 0 && (
          <View style={{
            backgroundColor: `${colors.warn}25`, borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 4,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.warn }}>
              🏆 {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <StatPill icon="time-outline" value={fmtDuration(workout.duration_seconds)} colors={colors} />
        <StatPill icon="barbell-outline" value={`${workout.exerciseNames.length} ex.`} colors={colors} />
        {workout.totalVolume > 0 && (
          <StatPill icon="trending-up-outline" value={fmtVolume(workout.totalVolume)} colors={colors} />
        )}
        {workout.xp_earned > 0 && (
          <StatPill icon="flash-outline" value={`+${workout.xp_earned} XP`} colors={colors} accent />
        )}
      </View>

      {/* Exercices */}
      {workout.exerciseNames.length > 0 && (
        <Text style={{ fontSize: 12, color: colors.mute, lineHeight: 18 }} numberOfLines={2}>
          {workout.exerciseNames.slice(0, 5).join(' · ')}
          {workout.exerciseNames.length > 5 ? ` +${workout.exerciseNames.length - 5}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function StatPill({ icon, value, colors, accent }: {
  icon: string; value: string;
  colors: ReturnType<typeof useTheme>; accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon as any} size={13} color={accent ? colors.accent : colors.mute} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: accent ? colors.accent : colors.text2 }}>{value}</Text>
    </View>
  );
}

// ── Modal détail séance ───────────────────────────────────────────────────────
function WorkoutDetailModal({
  workout, visible, onClose, colors,
}: {
  workout: WorkoutEntry | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const insets = useSafeAreaInsets();
  if (!workout) return null;

  // Grouper les sets par exercice
  const byExercise = new Map<string, { name: string; sets: SetEntry[] }>();
  for (const s of workout.set_logs) {
    const name = s.exercises?.name ?? 'Exercice';
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { name, sets: [] });
    }
    byExercise.get(s.exercise_id)!.sets.push(s);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: `${colors.bg}F0`, justifyContent: 'flex-end' }}>
        <SafeAreaView
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.border, maxHeight: '90%' }}
          edges={['bottom']}
        >
          <View style={{ padding: 20, paddingBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                {workout.sessionName}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>
                {new Date(workout.started_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}{fmtDuration(workout.duration_seconds)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 20 }}
          >
            {/* Stats summary */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Volume', value: workout.totalVolume > 0 ? fmtVolume(workout.totalVolume) : '—' },
                { label: 'Records', value: workout.prCount > 0 ? `🏆 ${workout.prCount}` : '—' },
                { label: 'XP gagné', value: `⚡ ${workout.xp_earned}` },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accent }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: colors.mute, marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Exercices + sets */}
            {Array.from(byExercise.values()).map(({ name, sets }) => (
              <View key={name} style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{name}</Text>
                {sets.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.mute }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, color: colors.text2 }}>
                      {s.weight_kg ? `${s.weight_kg} kg` : 'Poids du corps'} × {s.reps ?? '?'} reps
                    </Text>
                    {s.is_pr && <Text style={{ fontSize: 12, color: colors.warn }}>🏆 PR</Text>}
                  </View>
                ))}
              </View>
            ))}

            {workout.notes && (
              <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 12, color: colors.mute }}>📝 {workout.notes}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const colors = useTheme();

  const [groups,  setGroups]  = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkoutEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data } = await supabase
        .from('workout_logs')
        .select(`
          id, started_at, ended_at, duration_seconds, notes, xp_earned,
          program_sessions(name),
          set_logs(reps, weight_kg, is_pr, exercise_id, exercises(name))
        `)
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(60);

      const workouts: WorkoutEntry[] = (data ?? []).map((w: any) => {
        const sets: SetEntry[] = w.set_logs ?? [];
        const totalVolume = sets.reduce((sum, s) => sum + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0);
        const prCount     = sets.filter((s) => s.is_pr).length;
        const exMap       = new Map<string, string>();
        sets.forEach((s) => {
          if (s.exercise_id && s.exercises?.name) exMap.set(s.exercise_id, s.exercises.name);
        });

        return {
          ...w,
          sessionName: w.program_sessions?.name ?? 'Séance libre',
          totalVolume,
          prCount,
          exerciseNames: Array.from(exMap.values()),
        } as WorkoutEntry;
      });

      setGroups(groupByWeek(workouts));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>
          📖 Historique
        </Text>
        <Text style={{ fontSize: 12, color: colors.mute }}>
          {groups.reduce((s, g) => s + g.workouts.length, 0)} séances
        </Text>
      </View>

      {groups.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 48 }}>📖</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Aucune séance</Text>
          <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center' }}>
            Commence ton premier entraînement pour remplir ton historique !
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/train/active')}
            style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: '800' }}>Démarrer une séance →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 80 }}>
          {groups.map((group, gi) => (
            <View key={gi}>
              {/* En-tête de semaine */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{group.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{group.dateRange}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                    {group.workouts.length} séance{group.workouts.length > 1 ? 's' : ''}
                  </Text>
                  {group.totalVolume > 0 && (
                    <Text style={{ fontSize: 11, color: colors.mute }}>
                      {fmtVolume(group.totalVolume)} de volume
                    </Text>
                  )}
                </View>
              </View>

              {/* Cartes séances */}
              <View style={{ gap: 10 }}>
                {group.workouts.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    workout={w}
                    colors={colors}
                    onPress={() => setSelected(w)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <WorkoutDetailModal
        workout={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        colors={colors}
      />
    </SafeAreaView>
  );
}
