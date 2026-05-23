/**
 * Détail d'une séance passée — tous les exercices, toutes les séries,
 * badges PR, stats agrégées, note et commentaire.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { exerciseNameFromUuid, exerciseMuscleGroupFromUuid } from '../../lib/muscleVolume';

// ── Types ─────────────────────────────────────────────────────────────
type SetLog = {
  id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  is_pr: boolean;
  rpe: number | null;
};

type WorkoutDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  xp_earned: number;
  notes: string | null;
  rating: number | null;
  program_sessions: { name: string; day_index: number } | null;
  set_logs: SetLog[];
};

type ExerciseGroup = {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  sets: SetLog[];
  hasPR: boolean;
  maxWeight: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAY_NAMES = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function groupByExercise(sets: SetLog[]): ExerciseGroup[] {
  const map = new Map<string, SetLog[]>();
  for (const s of sets.sort((a, b) => a.set_index - b.set_index)) {
    if (!map.has(s.exercise_id)) map.set(s.exercise_id, []);
    map.get(s.exercise_id)!.push(s);
  }
  const groups: ExerciseGroup[] = [];
  map.forEach((groupSets, exerciseId) => {
    const weights = groupSets.map((s) => s.weight_kg).filter(Boolean) as number[];
    groups.push({
      exerciseId,
      name:        exerciseNameFromUuid(exerciseId),
      muscleGroup: exerciseMuscleGroupFromUuid(exerciseId),
      sets:        groupSets,
      hasPR:       groupSets.some((s) => s.is_pr),
      maxWeight:   weights.length > 0 ? Math.max(...weights) : null,
    });
  });
  return groups;
}

function totalVolume(sets: SetLog[]): number {
  return sets.reduce((acc, s) => acc + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
}

// ── Composant ligne de série ──────────────────────────────────────────
function SetRow({ s, idx, colors }: { s: SetLog; idx: number; colors: any }) {
  const isPR = s.is_pr;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      {/* Numéro */}
      <View style={{
        width: 26, height: 26, borderRadius: 8,
        backgroundColor: isPR ? `${colors.warn}25` : colors.surface2,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: isPR ? colors.warn : colors.mute }}>{idx + 1}</Text>
      </View>

      {/* Poids */}
      <View style={{ width: 80, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 6 }}>
        <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 1 }}>Poids</Text>
        <Text style={{
          fontSize: 15, fontWeight: '800',
          color: s.weight_kg != null ? colors.accent : colors.mute,
        }}>
          {s.weight_kg != null ? `${s.weight_kg} kg` : '—'}
        </Text>
      </View>

      <Text style={{ fontSize: 14, color: colors.mute, fontWeight: '600' }}>×</Text>

      {/* Reps */}
      <View style={{ width: 68, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 6 }}>
        <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 1 }}>Reps</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
          {s.reps ?? '—'}
        </Text>
      </View>

      {/* RPE */}
      {s.rpe != null && (
        <View style={{ width: 52, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 1 }}>RPE</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text2 }}>{s.rpe}</Text>
        </View>
      )}

      {/* Spacer + PR */}
      <View style={{ flex: 1 }} />
      {isPR && (
        <View style={{ backgroundColor: `${colors.warn}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: `${colors.warn}40` }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.warn }}>PR 🏆</Text>
        </View>
      )}
    </View>
  );
}

// ── Composant carte exercice ──────────────────────────────────────────
function ExerciseCard({ group, colors }: { group: ExerciseGroup; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const vol = group.sets.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: group.hasPR ? `${colors.warn}40` : colors.border,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* En-tête exercice */}
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
      >
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: group.hasPR ? `${colors.warn}20` : `${colors.accent}18`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 16 }}>{group.hasPR ? '🏆' : '💪'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{group.name}</Text>
          <Text style={{ fontSize: 12, color: colors.mute, marginTop: 1 }}>
            {group.sets.length} série{group.sets.length > 1 ? 's' : ''} · {group.muscleGroup}
            {vol > 0 ? ` · ${Math.round(vol)} kg total` : ''}
          </Text>
        </View>

        {group.maxWeight != null && (
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
            {group.maxWeight} kg
          </Text>
        )}

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={colors.mute}
        />
      </TouchableOpacity>

      {/* Liste des séries */}
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          {group.sets.map((s, i) => (
            <SetRow key={s.id} s={s} idx={i} colors={colors} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors  = useTheme();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select(`
          id, started_at, ended_at, duration_seconds, xp_earned, notes, rating,
          program_sessions ( name, day_index ),
          set_logs ( id, exercise_id, set_index, reps, weight_kg, is_pr, rpe )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (__DEV__) console.error('workout detail', error);
        Alert.alert('Erreur', 'Impossible de charger cette séance.');
      } else {
        setWorkout(data as unknown as WorkoutDetail);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!workout) return null;

  const exerciseGroups = groupByExercise(workout.set_logs);
  const prCount        = workout.set_logs.filter((s) => s.is_pr).length;
  const vol            = Math.round(totalVolume(workout.set_logs));
  const sessionName    = workout.program_sessions?.name ?? 'Séance libre';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.push('/history' as any)}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1}>
            {sessionName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mute, marginTop: 1 }}>
            {formatDate(workout.started_at)}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 4 }}>

        {/* Bannière stats */}
        <LinearGradient
          colors={[`${colors.accent}18`, `${colors.bg}`]}
          style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: `${colors.accent}25`, marginBottom: 20 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.mute }}>Heure de début</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
                {formatTime(workout.started_at)}
              </Text>
            </View>
            {workout.ended_at && (
              <>
                <Ionicons name="arrow-forward" size={18} color={colors.mute} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: colors.mute }}>Heure de fin</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
                    {formatTime(workout.ended_at)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 0 }}>
            {[
              { icon: 'time-outline',   label: 'Durée',    value: formatDuration(workout.duration_seconds) },
              { icon: 'layers-outline', label: 'Séries',   value: String(workout.set_logs.length) },
              { icon: 'barbell-outline',label: 'Exos',     value: String(exerciseGroups.length) },
              { icon: 'flash-outline',  label: 'XP',       value: `+${workout.xp_earned}` },
            ].map((stat, i) => (
              <View key={stat.label} style={{
                flex: 1, alignItems: 'center',
                borderLeftWidth: i > 0 ? 1 : 0,
                borderLeftColor: colors.border,
              }}>
                <Ionicons name={stat.icon as any} size={16} color={colors.accent} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: colors.mute, marginTop: 1 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* PRs + Tonnage */}
          {(prCount > 0 || vol > 0) && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {prCount > 0 && (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.warn}18`, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: `${colors.warn}30` }}>
                  <Text style={{ fontSize: 16 }}>🏆</Text>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.warn }}>{prCount} PR</Text>
                    <Text style={{ fontSize: 10, color: colors.mute }}>record{prCount > 1 ? 's' : ''} battu{prCount > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              )}
              {vol > 0 && (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 16 }}>⚖️</Text>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                      {vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${vol} kg`}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.mute }}>tonnage total</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Note étoiles */}
          {workout.rating != null && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: colors.mute }}>Ressenti :</Text>
              <Text style={{ fontSize: 16 }}>{'⭐'.repeat(workout.rating)}{'☆'.repeat(5 - workout.rating)}</Text>
            </View>
          )}

          {/* Commentaire */}
          {workout.notes && (
            <View style={{ marginTop: 10, backgroundColor: colors.surface2, borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 13, color: colors.text2, fontStyle: 'italic', lineHeight: 18 }}>
                "{workout.notes}"
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Titre section exercices */}
        <Text style={{
          fontSize: 12, fontWeight: '700', color: colors.mute,
          textTransform: 'uppercase', letterSpacing: 0.5,
          marginBottom: 12,
        }}>
          {exerciseGroups.length} exercice{exerciseGroups.length > 1 ? 's' : ''}
        </Text>

        {/* Liste exercices */}
        {exerciseGroups.map((g) => (
          <ExerciseCard key={g.exerciseId} group={g} colors={colors} />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}
