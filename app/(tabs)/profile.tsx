import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Palette } from '../../constants/theme';
import type { Profile, Achievement } from '../../lib/database.types';

// Level curve: level N requires 500 * N XP cumulatively in-band
const XP_PER_LEVEL = 500;
function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, pct: into / XP_PER_LEVEL, toNext: XP_PER_LEVEL - into };
}

const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#5C7CFF',
  epic: '#A855F7',
  legendary: '#FFB13D',
};

export default function ProfileScreen() {
  const colors = useTheme();
  const { profile, setProfile, setPalette, palette } = useAppStore();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ workouts: 0, prs: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const [{ data: fresh }, { data: allAch }, { data: mine }, { count: wCount }, { count: prCount }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('achievements').select('*').order('xp_reward', { ascending: true }),
        supabase.from('user_achievements').select('achievement_id, achievements(code)').eq('user_id', user.id),
        supabase.from('workout_logs').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).not('ended_at', 'is', null),
        supabase.from('personal_records').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

    if (fresh) setProfile(fresh as Profile);
    setAchievements((allAch ?? []) as Achievement[]);
    setUnlocked(new Set((mine ?? []).map((m: any) => m.achievements?.code).filter(Boolean)));
    setStats({ workouts: wCount ?? 0, prs: prCount ?? 0 });
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert('Se déconnecter ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)');
        },
      },
    ]);
  };

  const handlePalette = async (p: Palette) => {
    setPalette(p);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('profiles').update({ palette: p }).eq('id', session.user.id);
    }
  };

  const { level, into, pct, toNext } = levelInfo(profile?.xp ?? 0);
  const unlockedCount = achievements.filter((a) => unlocked.has(a.code)).length;

  const menuItems = [
    { icon: 'barbell-outline',  label: 'Mon programme',       route: '/program' },
    { icon: 'time-outline',     label: 'Historique des séances', route: '/history' },
    { icon: 'images-outline',   label: 'Ma galerie photos',   route: '/gallery' },
    { icon: 'body-outline',     label: 'Analyse musculaire',  route: '/body' },
    { icon: 'trophy-outline',   label: 'Classements',         route: '/rankings' },
    { icon: 'nutrition-outline',label: 'Suivi quotidien',     route: '/daily' },
    { icon: 'settings-outline', label: 'Paramètres',          route: '/settings' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}
      >
        {/* Profile card */}
        <LinearGradient
          colors={[`${colors.accent}18`, `${colors.bg}`]}
          style={{ borderRadius: 20, padding: 20, borderWidth: 1, borderColor: `${colors.accent}25` }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: colors.accent,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.accentInk }}>
                {(profile?.username ?? 'A')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{profile?.username ?? '—'}</Text>
              <Text style={{ fontSize: 13, color: colors.mute, marginTop: 2 }}>
                {profile?.goal === 'muscle' ? 'Masse musculaire' :
                 profile?.goal === 'strength' ? 'Force' :
                 profile?.goal === 'weight_loss' ? 'Perte de poids' :
                 profile?.goal === 'endurance' ? 'Endurance' : 'Objectif général'}
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: `${colors.accent}20`, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>Niv {level}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="pencil-outline" size={12} color={colors.mute} />
                <Text style={{ fontSize: 11, color: colors.mute }}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Level progress */}
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: colors.text2, fontWeight: '600' }}>{into} / {XP_PER_LEVEL} XP</Text>
              <Text style={{ fontSize: 11, color: colors.mute }}>{toNext} XP → niv {level + 1}</Text>
            </View>
            <ProgressBar value={pct} />
          </View>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 18 }}>
            {[
              { label: 'XP total', value: profile?.xp ?? 0 },
              { label: 'Streak', value: `${profile?.streak_days ?? 0}j` },
              { label: 'Séances', value: stats.workouts },
              { label: 'Records', value: stats.prs },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.accent }}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: colors.mute, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Achievements */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Succès
            </Text>
            <Text style={{ fontSize: 12, color: colors.text2, fontWeight: '600' }}>
              {unlockedCount} / {achievements.length}
            </Text>
          </View>
          <Card padding={14}>
            {achievements.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.mute, textAlign: 'center', padding: 8 }}>
                Aucun succès configuré.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {achievements.map((a) => {
                  const has = unlocked.has(a.code);
                  const rc = RARITY_COLOR[a.rarity] ?? colors.mute;
                  return (
                    <View
                      key={a.id}
                      style={{
                        width: '30%', alignItems: 'center', gap: 4,
                        opacity: has ? 1 : 0.32,
                        paddingVertical: 10, borderRadius: 12,
                        backgroundColor: has ? `${rc}15` : colors.surface2,
                        borderWidth: 1, borderColor: has ? `${rc}50` : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>{has ? (a.icon ?? '🏅') : '🔒'}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: has ? colors.text : colors.mute, textAlign: 'center' }}>
                        {a.name}
                      </Text>
                      <Text style={{ fontSize: 8, color: rc, textTransform: 'uppercase', fontWeight: '700' }}>
                        {a.rarity}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </View>

        {/* Palette */}
        <Card padding={16}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.mute, marginBottom: 12 }}>THÈME</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([
              { id: 'volt', color: '#C7FF3D', label: 'Volt' },
              { id: 'pulse', color: '#FF4D8F', label: 'Pulse' },
              { id: 'mono', color: '#8B5CF6', label: 'Mono' },
            ] as { id: Palette; color: string; label: string }[]).map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => handlePalette(p.id)}
                style={{
                  flex: 1, alignItems: 'center', gap: 6,
                  padding: 12, borderRadius: 12,
                  backgroundColor: palette === p.id ? `${p.color}20` : colors.surface2,
                  borderWidth: 1.5,
                  borderColor: palette === p.id ? p.color : colors.border,
                }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.color }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: palette === p.id ? colors.text : colors.mute }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Menu */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                padding: 16,
                borderBottomWidth: i < menuItems.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name={item.icon as any} size={20} color={colors.accent} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.text }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mute} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{ backgroundColor: `${colors.danger}18`, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: `${colors.danger}30` }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 15 }}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
