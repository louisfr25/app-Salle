import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { scheduleWorkoutReminders } from '../../lib/notifications';
import type { WorkoutLog, Program, ProgramSession } from '../../lib/database.types';

interface DaySession {
  session: ProgramSession;
  completed: boolean;
}

// Lundi de la semaine ISO contenant `d` (semaine Lun–Dim)
function getMondayOf(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Dim, 1=Lun … 6=Sam
  const daysFromMonday = (dow + 6) % 7;  // 0=Lun … 6=Dim
  copy.setDate(copy.getDate() - daysFromMonday);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function DashboardScreen() {
  const colors = useTheme();
  const profile = useAppStore((s) => s.profile);
  const [todaySession, setTodaySession] = useState<DaySession | null>(null);
  const [weekLogs, setWeekLogs] = useState<WorkoutLog[]>([]);
  const [weekTarget, setWeekTarget] = useState(5); // objectif séances/semaine
  const [refreshing, setRefreshing] = useState(false);

  // Noms de jours Lun–Dim (semaine ISO)
  const DAY_NAMES_MON = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const today = new Date();
  // Position de aujourd'hui dans la semaine ISO (0=Lun … 6=Dim)
  const daysFromMonday = (today.getDay() + 6) % 7;
  const weekStart = getMondayOf(today);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // Semaine ISO courante : Lundi 00:00 → Dimanche 23:59
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', weekStart.toISOString())
      .order('started_at', { ascending: false });

    setWeekLogs(logs ?? []);

    // Programme actif → objectif hebdo + séance du jour
    const { data: programs } = await supabase
      .from('programs')
      .select('*, program_sessions(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (programs) {
      // Objectif = nombre de jours d'entraînement du programme
      setWeekTarget(programs.days_per_week ?? 5);

      const sessions = (programs.program_sessions ?? []) as ProgramSession[];
      // day_index 0 = première séance du programme = Lundi de la semaine
      const daySession = sessions.find((s) => s.day_index === daysFromMonday);
      if (daySession) {
        const todayStr = today.toISOString().split('T')[0];
        const done = logs?.some(
          (l) =>
            l.program_session_id === daySession.id &&
            l.started_at.startsWith(todayStr),
        ) ?? false;
        setTodaySession({ session: daySession, completed: done });
      }

      // ── Planifier les rappels séances pour les 7 prochains jours ──
      const reminders: { name: string; date: Date }[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(today);
        d.setDate(today.getDate() + dayOffset);
        const isoDay = (d.getDay() + 6) % 7; // 0=Lun … 6=Dim
        const s = sessions.find((se) => se.day_index === isoDay);
        if (s) reminders.push({ name: s.name, date: d });
      }
      scheduleWorkoutReminders(reminders).catch(() => {});
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Grille Lun–Dim de la semaine ISO courante
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dayStr = d.toISOString().split('T')[0];
    const done = weekLogs.some((l) => l.started_at.startsWith(dayStr));
    return { label: DAY_NAMES_MON[i], date: d.getDate(), done, isToday: i === daysFromMonday };
  });

  const greeting =
    today.getHours() < 12
      ? 'Bonjour'
      : today.getHours() < 18
      ? 'Bon après-midi'
      : 'Bonsoir';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 20 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 13, color: colors.mute }}>{greeting} 👋</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
              {profile?.username ?? 'Athlete'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text2} />
          </TouchableOpacity>
        </View>

        {/* Streak & XP */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} padding={14}>
            <Text style={{ fontSize: 22 }}>🔥</Text>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.accent }}>{profile?.streak_days ?? 0}</Text>
              <Text style={{ fontSize: 11, color: colors.mute }}>Jours streak</Text>
            </View>
          </Card>
          <Card style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} padding={14}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{profile?.xp ?? 0}</Text>
              <Text style={{ fontSize: 11, color: colors.mute }}>XP total</Text>
            </View>
          </Card>
        </View>

        {/* Week days */}
        <Card padding={16}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Cette semaine
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {weekDays.map((d) => (
              <View key={d.label} style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 10, color: d.isToday ? colors.accent : colors.mute, fontWeight: d.isToday ? '700' : '400' }}>
                  {d.label}
                </Text>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: d.done ? colors.accent : d.isToday ? colors.surface2 : 'transparent',
                  borderWidth: d.isToday && !d.done ? 1.5 : 0,
                  borderColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: d.done ? colors.accentInk : d.isToday ? colors.accent : colors.mute }}>
                    {d.date}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <ProgressBar
            value={Math.min(weekLogs.length / weekTarget, 1)}
            style={{ marginTop: 14 }}
          />
          <Text style={{ fontSize: 11, color: colors.mute, marginTop: 6 }}>
            {weekLogs.length} / {weekTarget} séances cette semaine (lun–dim)
          </Text>
        </Card>

        {/* Today's session */}
        {todaySession ? (
          <LinearGradient
            colors={[`${colors.accent}20`, `${colors.accent}05`]}
            style={{ borderRadius: 18, borderWidth: 1, borderColor: `${colors.accent}40` }}
          >
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: todaySession.completed ? colors.success : colors.accent }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {todaySession.completed ? 'Séance terminée ✓' : "Séance du jour"}
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                {todaySession.session.name}
              </Text>
              <Text style={{ fontSize: 13, color: colors.text2, marginBottom: 16 }}>
                ~{todaySession.session.duration_min} min
              </Text>
              {!todaySession.completed && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/train/active', params: { sessionId: todaySession.session.id } })}
                  style={{
                    backgroundColor: colors.accent, borderRadius: 14,
                    padding: 14, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.accentInk, fontWeight: '700', fontSize: 16 }}>
                    Démarrer la séance →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        ) : (
          <Card padding={18}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
              Pas de séance prévue aujourd'hui
            </Text>
            <Text style={{ fontSize: 13, color: colors.mute, marginBottom: 14 }}>
              Repos ou séance libre ?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push('/train/active')}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentInk, fontWeight: '600' }}>Séance libre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/program')}
                style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Mon programme</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Quick access */}
        <SectionTitle title="Accès rapide" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { icon: '🧍', label: 'Analyse musculaire', route: '/body' },
            { icon: '🏆', label: 'Classements', route: '/rankings' },
            { icon: '🍎', label: 'Suivi quotidien', route: '/daily' },
            { icon: '📋', label: 'Mon programme', route: '/program' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              style={{
                width: '47%',
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
