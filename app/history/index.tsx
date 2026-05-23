/**
 * Historique des séances — liste chronologique groupée par mois,
 * avec résumé rapide (durée, séries, XP, PR).
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────
type RawLog = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  xp_earned: number;
  notes: string | null;
  rating: number | null;
  program_sessions: { name: string } | null;
  set_logs: { id: string; is_pr: boolean }[];
  workout_photos: { id: string }[];
};

type MonthSection = {
  title: string;          // "Mai 2026"
  data: RawLog[];
};

// ── Helpers ───────────────────────────────────────────────────────────
const DAY_NAMES   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "2026-05"
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function groupByMonth(logs: RawLog[]): MonthSection[] {
  const map = new Map<string, RawLog[]>();
  for (const log of logs) {
    const k = monthKey(log.started_at);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(log);
  }
  return Array.from(map.entries()).map(([k, data]) => ({
    title: monthLabel(k),
    data,
  }));
}

// ── Composant carte ───────────────────────────────────────────────────
function WorkoutCard({ log }: { log: RawLog }) {
  const colors = useTheme();
  const setCount   = log.set_logs.length;
  const prCount    = log.set_logs.filter((s) => s.is_pr).length;
  const photoCount = (log.workout_photos ?? []).length;
  const name       = log.program_sessions?.name ?? 'Séance libre';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/history/${log.id}` as any)}
      activeOpacity={0.75}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 10,
        gap: 10,
      }}
    >
      {/* Ligne 1 : date + flèche */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mute }}>
          {dayLabel(log.started_at)}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.mute} />
      </View>

      {/* Ligne 2 : nom de séance */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{name}</Text>

      {/* Ligne 3 : stats en badges */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Badge icon="time-outline"    value={formatDuration(log.duration_seconds)} colors={colors} />
        <Badge icon="layers-outline"  value={`${setCount} série${setCount > 1 ? 's' : ''}`} colors={colors} />
        <Badge icon="flash-outline"   value={`+${log.xp_earned} XP`} colors={colors} accent />
        {prCount > 0 && (
          <Badge icon="trophy-outline" value={`${prCount} PR`} colors={colors} gold />
        )}
        {photoCount > 0 && (
          <Badge icon="camera-outline" value={`${photoCount} 📸`} colors={colors} />
        )}
        {log.rating != null && (
          <Badge icon="star-outline" value={'⭐'.repeat(log.rating)} colors={colors} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function Badge({
  icon, value, colors, accent = false, gold = false,
}: { icon: string; value: string; colors: any; accent?: boolean; gold?: boolean }) {
  const bg    = gold ? `${colors.warn}18` : accent ? `${colors.accent}18` : colors.surface2;
  const color = gold ? colors.warn        : accent ? colors.accent        : colors.text2;
  const border = gold ? `${colors.warn}30` : accent ? `${colors.accent}30` : colors.border;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: border }}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '600', color }}>{value}</Text>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────
export default function HistoryScreen() {
  const colors = useTheme();
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from('workout_logs')
      .select(`
        id, started_at, ended_at, duration_seconds, xp_earned, notes, rating,
        program_sessions ( name ),
        set_logs ( id, is_pr ),
        workout_photos ( id )
      `)
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false });

    if (!error && data) {
      const logs = data as unknown as RawLog[];
      setSections(groupByMonth(logs));
      setTotalWorkouts(logs.length);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Historique</Text>
          {totalWorkouts > 0 && (
            <Text style={{ fontSize: 12, color: colors.mute, marginTop: 1 }}>
              {totalWorkouts} séance{totalWorkouts > 1 ? 's' : ''} enregistrée{totalWorkouts > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 48 }}>🏋️</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
            Pas encore de séance
          </Text>
          <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
            Lance ta première séance pour commencer à construire ton historique !
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: '700' }}>C'est parti 🚀</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <WorkoutCard log={item} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, backgroundColor: colors.bg }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {title}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </SafeAreaView>
  );
}
