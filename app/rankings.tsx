import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../lib/store/useAppStore';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';

interface RankEntry {
  username: string;
  xp: number;
  streak_days: number;
  rank: number;
  isMe: boolean;
}

interface PrEntry {
  username: string;
  weight: number;
  reps: number;
  oneRM: number;
  isMe: boolean;
}

interface ExerciseGroup {
  exerciseId: string;
  name: string;
  entries: PrEntry[];
}

type Tab = 'xp' | 'streak' | 'pr';

export default function RankingsScreen() {
  const colors = useTheme();
  const profile = useAppStore((s) => s.profile);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [prGroups, setPrGroups] = useState<ExerciseGroup[]>([]);
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('xp');

  useEffect(() => {
    if (tab === 'pr') loadPrRankings();
    else loadRankings();
  }, [tab]);

  const loadRankings = async () => {
    // Vue publique : ne contient que les champs non sensibles.
    const { data } = await supabase
      .from('public_profiles')
      .select('username, xp, streak_days')
      .order(tab === 'xp' ? 'xp' : 'streak_days', { ascending: false })
      .limit(20);

    const entries = (data ?? []).map((p, i) => ({
      username: p.username,
      xp: p.xp,
      streak_days: p.streak_days,
      rank: i + 1,
      isMe: p.username === profile?.username,
    }));
    setRankings(entries);
  };

  const loadPrRankings = async () => {
    const { data } = await supabase
      .from('personal_records')
      .select('exercise_id, user_id, one_rm_kg, weight_kg, reps, exercises(name)')
      .order('one_rm_kg', { ascending: false });

    const rows = (data ?? []) as any[];

    // Résolution des pseudos via la vue publique (pas d'embed sur
    // `profiles` qui est désormais restreint à sa propre ligne).
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: pp } = await supabase
        .from('public_profiles')
        .select('id, username')
        .in('id', userIds);
      for (const p of (pp ?? []) as any[]) nameById.set(p.id, p.username);
    }

    const map = new Map<string, ExerciseGroup>();
    for (const r of rows) {
      const name = r.exercises?.name ?? 'Exercice';
      const username = nameById.get(r.user_id) ?? '—';
      if (!map.has(r.exercise_id)) {
        map.set(r.exercise_id, { exerciseId: r.exercise_id, name, entries: [] });
      }
      map.get(r.exercise_id)!.entries.push({
        username,
        weight: Number(r.weight_kg ?? 0),
        reps: Number(r.reps ?? 0),
        oneRM: Number(r.one_rm_kg ?? 0),
        isMe: username === profile?.username,
      });
    }
    // Already globally sorted by one_rm desc → per-group order preserved.
    const groups = Array.from(map.values()).sort(
      (a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name),
    );
    setPrGroups(groups);
  };

  const myRank = rankings.find((r) => r.isMe);
  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Classements</Text>
        </View>

        {/* My rank hero (xp / streak only) */}
        {tab !== 'pr' && myRank && (
          <LinearGradient
            colors={[`${colors.accent}20`, `${colors.bg}`]}
            style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: `${colors.accent}30` }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ta position</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: colors.accent }}>#{myRank.rank}</Text>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{myRank.username}</Text>
                <Text style={{ fontSize: 13, color: colors.mute }}>{tab === 'xp' ? `${myRank.xp} XP` : `${myRank.streak_days} jours streak`}</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4 }}>
          {([['xp', '⚡ XP'], ['streak', '🔥 Streak'], ['pr', '🏋️ Records']] as [Tab, string][]).map(([t, l]) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: tab === t ? colors.surface2 : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: tab === t ? colors.text : colors.mute }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── XP / STREAK leaderboard ── */}
        {tab !== 'pr' && (
          <>
            {podium.length > 0 && (
              <Card padding={16}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.mute, marginBottom: 14 }}>🏆 PODIUM</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
                  {[podium[1], podium[0], podium[2]].filter(Boolean).map((entry, i) => {
                    const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    const height = realRank === 1 ? 80 : realRank === 2 ? 60 : 48;
                    return (
                      <View key={entry.username} style={{ alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: entry.isMe ? colors.accent : colors.text }}>{entry.username}</Text>
                        <Text style={{ fontSize: 11, color: colors.mute }}>{tab === 'xp' ? `${entry.xp} XP` : `${entry.streak_days}j`}</Text>
                        <View style={{
                          width: 72, height,
                          backgroundColor: medalColors[realRank - 1] + '30',
                          borderTopLeftRadius: 6, borderTopRightRadius: 6,
                          borderWidth: 1, borderColor: medalColors[realRank - 1] + '60',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 20 }}>{realRank === 1 ? '🥇' : realRank === 2 ? '🥈' : '🥉'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            {rest.length > 0 && (
              <Card padding={0} style={{ overflow: 'hidden' }}>
                {rest.map((entry, i) => (
                  <View
                    key={entry.username}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
                      borderBottomWidth: i < rest.length - 1 ? 1 : 0, borderBottomColor: colors.border,
                      backgroundColor: entry.isMe ? `${colors.accent}10` : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.mute, width: 28 }}>#{entry.rank}</Text>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: entry.isMe ? colors.accent : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: entry.isMe ? colors.accentInk : colors.text }}>{entry.username[0].toUpperCase()}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: entry.isMe ? '700' : '500', color: entry.isMe ? colors.accent : colors.text }}>
                      {entry.username} {entry.isMe ? '(toi)' : ''}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text2 }}>
                      {tab === 'xp' ? `${entry.xp} XP` : `${entry.streak_days}j`}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {rankings.length === 0 && (
              <Card padding={20}>
                <Text style={{ color: colors.mute, textAlign: 'center' }}>Aucun classement disponible pour l'instant.</Text>
              </Card>
            )}
          </>
        )}

        {/* ── PR per-exercise leaderboard ── */}
        {tab === 'pr' && (
          <>
            <Text style={{ fontSize: 12, color: colors.mute }}>
              Classement par <Text style={{ fontWeight: '700', color: colors.text2 }}>meilleur record réel</Text> — la plus lourde charge soulevée avec le maximum de répétitions.
            </Text>
            {prGroups.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.mute, textAlign: 'center' }}>
                  Aucun record enregistré pour l'instant. Termine des séances avec du poids pour apparaître ici !
                </Text>
              </Card>
            ) : (
              <Card padding={0} style={{ overflow: 'hidden' }}>
                {prGroups.map((g, gi) => {
                  const open = openExercise === g.exerciseId;
                  return (
                    <View key={g.exerciseId} style={{ borderBottomWidth: gi < prGroups.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                      <TouchableOpacity
                        onPress={() => setOpenExercise(open ? null : g.exerciseId)}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                      >
                        <Ionicons name="barbell-outline" size={18} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{g.name}</Text>
                          <Text style={{ fontSize: 11, color: colors.mute }}>
                            {g.entries.length} athlète{g.entries.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>
                            {g.entries[0]?.weight}kg × {g.entries[0]?.reps}
                          </Text>
                          <Text style={{ fontSize: 9, color: colors.mute }}>meilleur record</Text>
                        </View>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mute} />
                      </TouchableOpacity>

                      {open && (
                        <View style={{ paddingBottom: 8 }}>
                          {g.entries.map((e, i) => (
                            <View
                              key={`${g.exerciseId}-${e.username}-${i}`}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 12,
                                paddingVertical: 10, paddingHorizontal: 16,
                                backgroundColor: e.isMe ? `${colors.accent}12` : 'transparent',
                              }}
                            >
                              <Text style={{
                                width: 26, fontSize: 13, fontWeight: '800',
                                color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.mute,
                              }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                              </Text>
                              <Text style={{ flex: 1, fontSize: 14, fontWeight: e.isMe ? '700' : '500', color: e.isMe ? colors.accent : colors.text }}>
                                {e.username} {e.isMe ? '(toi)' : ''}
                              </Text>
                              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                                {e.weight}kg × {e.reps}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
