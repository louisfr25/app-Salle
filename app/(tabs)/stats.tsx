/**
 * Dashboard Performances — 3 onglets :
 *  • Progression : poids corporel, tonnage 12 sem., fréquence, calendrier
 *  • Muscles     : volume par groupe musculaire (semaine en cours)
 *  • Records     : PRs par exercice + courbe de progression 1RM
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { estimateOneRM } from '../../lib/gamification';
import { weekStartStr } from '../../lib/muscleVolume';
import { LineChart, type LinePoint } from '../../components/charts/LineChart';
import { BarChart, type BarItem } from '../../components/charts/BarChart';
import type { PersonalRecord } from '../../lib/database.types';

// ── Constantes ────────────────────────────────────────────────────────
const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
const DAYS_FR = ['L','M','M','J','V','S','D'];

type WeightPeriod = '2w' | '1m' | '3m' | 'all';
type PRPeriod = '30d' | '6m' | 'all';
type Tab = 'progress' | 'muscles' | 'records';

const WEIGHT_PERIOD_DAYS: Record<WeightPeriod, number | null> = {
  '2w': 14, '1m': 30, '3m': 90, all: null,
};
const WEIGHT_PERIOD_LABEL: Record<WeightPeriod, string> = {
  '2w': '2 sem.', '1m': '1 mois', '3m': '3 mois', all: 'Tout',
};
const PR_PERIOD_LABEL: Record<PRPeriod, string> = {
  '30d': '30 jours', '6m': '6 mois', all: 'Tout',
};

const MUSCLE_NAME: Record<string, string> = {
  pec_upper: 'Pecto. sup.',   pec_mid: 'Pecto. moy.',  pec_lower: 'Pecto. inf.',
  delt_front: 'Delt. ant.',   delt_side: 'Delt. lat.', delt_rear: 'Delt. post.',
  traps: 'Trapèzes',          lats: 'Grand dorsal',    lower_back: 'Lombaires',
  biceps: 'Biceps',           triceps: 'Triceps',      forearms: 'Avant-bras',
  abs_upper: 'Abdos sup.',    abs_lower: 'Abdos inf.', obliques: 'Obliques',
  quads: 'Quadriceps',        glutes: 'Fessiers',      hamstrings: 'Ischio-jamb.',
  calves: 'Mollets',
};

// ── Helpers ───────────────────────────────────────────────────────────
function weekKey(d: Date): string {
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return mon.toISOString().split('T')[0];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function pct(delta: number, base: number) {
  if (!base) return null;
  const v = Math.round((delta / base) * 100);
  return v > 0 ? `+${v}%` : `${v}%`;
}

// ── Composant : barre musculaire horizontale ──────────────────────────
function MuscleBar({ name, value, max, colors }: { name: string; value: number; max: number; colors: any }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: colors.text2, width: 90 }} numberOfLines={1}>{name}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: colors.surface3, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{
          width: `${w}%`, height: '100%', borderRadius: 4,
          backgroundColor: colors.accent,
          opacity: 0.5 + (w / 200), // un peu plus lumineux pour les grands
        }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent, width: 32, textAlign: 'right' }}>
        {Math.round(value)}%
      </Text>
    </View>
  );
}

// ── Composant : calendrier d'assiduité (28 derniers jours) ───────────
function AttendanceCalendar({ workoutDays, colors }: { workoutDays: Set<string>; colors: any }) {
  const today = new Date();
  const days: { iso: string; label: number; worked: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    days.push({ iso, label: d.getDate(), worked: workoutDays.has(iso) });
  }
  const total = days.filter((d) => d.worked).length;

  return (
    <View>
      {/* Légende jours */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAYS_FR.map((d, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 9, color: colors.mute, textAlign: 'center' }}>{d}</Text>
        ))}
      </View>
      {/* 4 semaines */}
      {[0, 1, 2, 3].map((week) => (
        <View key={week} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {days.slice(week * 7, week * 7 + 7).map((d) => (
            <View key={d.iso} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{
                width: 24, height: 24, borderRadius: 6,
                backgroundColor: d.worked ? colors.accent : colors.surface2,
                borderWidth: 1,
                borderColor: d.worked ? colors.accent : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 9, fontWeight: d.worked ? '800' : '400', color: d.worked ? colors.accentInk : colors.mute }}>
                  {d.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4, textAlign: 'right' }}>
        {total} séance{total > 1 ? 's' : ''} sur 28 jours · {Math.round((total / 28) * 100)}% assiduité
      </Text>
    </View>
  );
}

// ── Composant : bandeau stat ──────────────────────────────────────────
function StatBadge({ icon, value, label, sub, colors }: { icon: string; value: string; label: string; sub?: string; colors: any }) {
  return (
    <View style={{
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 12, gap: 2, alignItems: 'center',
    }}>
      <Ionicons name={icon as any} size={16} color={colors.accent} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent, marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.mute }}>{label}</Text>
      {sub && <Text style={{ fontSize: 10, color: colors.text2 }}>{sub}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const colors = useTheme();
  const [tab, setTab] = useState<Tab>('progress');
  const [refreshing, setRefreshing] = useState(false);

  // ── Données brutes ────────────────────────────────────────────────
  const [allWeightPoints, setAllWeightPoints] = useState<LinePoint[]>([]);
  const [weightPeriod, setWeightPeriod] = useState<WeightPeriod>('1m');
  const [tonBars, setTonBars] = useState<BarItem[]>([]);
  const [freqBars, setFreqBars] = useState<BarItem[]>([]);
  const [workoutDays, setWorkoutDays] = useState<Set<string>>(new Set());
  const [kpis, setKpis] = useState({ sessions: 0, avgMin: 0, totalTon: 0, totalXP: 0 });

  // Muscles
  const [muscleVolume, setMuscleVolume] = useState<{ id: string; pct: number }[]>([]);

  // Records
  const [prs, setPrs] = useState<(PersonalRecord & { exercises: { name: string } })[]>([]);
  const [prDetail, setPrDetail] = useState<{ exerciseId: string; name: string } | null>(null);
  const [prPeriod, setPrPeriod] = useState<PRPeriod>('30d');
  const [prChart, setPrChart] = useState<LinePoint[]>([]);
  const [prLoading, setPrLoading] = useState(false);

  // ── Courbe de poids filtrée ───────────────────────────────────────
  const weightPoints = (() => {
    const days = WEIGHT_PERIOD_DAYS[weightPeriod];
    if (!days) return allWeightPoints;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return allWeightPoints.filter((p) => {
      // label is "DD MMM" — we can't easily filter without storing iso separately,
      // so we store iso as a hidden field on label using allWeightPointsFull
      return true; // filtered via allWeightPointsFull below
    });
  })();

  // Use a richer internal store with iso dates
  const [allWeightFull, setAllWeightFull] = useState<{ iso: string; label: string; value: number }[]>([]);
  const filteredWeight = (() => {
    const days = WEIGHT_PERIOD_DAYS[weightPeriod];
    if (!days) return allWeightFull;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return allWeightFull.filter((p) => p.iso >= cutoff);
  })();
  const weightSeries: LinePoint[] = filteredWeight.map((p) => ({ label: p.label, value: p.value }));

  // ── Chargement ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000).toISOString();

    const [
      { data: weightData },
      { data: setData },
      { data: logsData },
      { data: prData },
      { data: muscleData },
    ] = await Promise.all([
      supabase.from('daily_logs')
        .select('date, body_weight_kg')
        .eq('user_id', user.id)
        .not('body_weight_kg', 'is', null)
        .order('date', { ascending: true }),

      supabase.from('set_logs')
        .select('completed_at, reps, weight_kg, workout_logs!inner(user_id)')
        .eq('workout_logs.user_id', user.id)
        .gte('completed_at', twelveWeeksAgo),

      supabase.from('workout_logs')
        .select('started_at, ended_at, duration_seconds, xp_earned')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .gte('started_at', twelveWeeksAgo),

      supabase.from('personal_records')
        .select('*, exercises(name)')
        .eq('user_id', user.id)
        .order('one_rm_kg', { ascending: false }),

      supabase.from('muscle_volume_weeks')
        .select('muscle_id, volume_pct')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr())
        .order('volume_pct', { ascending: false }),
    ]);

    // ── Poids corporel ────────────────────────────────────────────
    const wfull = (weightData ?? []).map((d: any) => {
      const dt = new Date(d.date);
      return { iso: d.date as string, label: `${dt.getDate()} ${MONTHS[dt.getMonth()]}`, value: Number(d.body_weight_kg) };
    });
    setAllWeightFull(wfull);
    setAllWeightPoints(wfull.map((w) => ({ label: w.label, value: w.value })));

    // ── Tonnage 12 semaines ───────────────────────────────────────
    const tonBuckets: Record<string, number> = {};
    for (const s of (setData ?? []) as any[]) {
      const k = weekKey(new Date(s.completed_at));
      tonBuckets[k] = (tonBuckets[k] ?? 0) + (s.weight_kg ?? 0) * (s.reps ?? 0);
    }
    const tonWeeks: BarItem[] = [];
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(Date.now() - i * 7 * 86400000);
      const k = weekKey(ref);
      const m = new Date(k);
      tonWeeks.push({
        label: `${m.getDate()}/${m.getMonth() + 1}`,
        value: Math.round(tonBuckets[k] ?? 0),
        highlight: i === 0,
      });
    }
    setTonBars(tonWeeks);

    // ── Fréquence 12 semaines ─────────────────────────────────────
    const freqBuckets: Record<string, number> = {};
    const daysSet = new Set<string>();
    for (const l of (logsData ?? []) as any[]) {
      const k = weekKey(new Date(l.started_at));
      freqBuckets[k] = (freqBuckets[k] ?? 0) + 1;
      daysSet.add((l.started_at as string).split('T')[0]);
    }
    setWorkoutDays(daysSet);

    const freqWeeks: BarItem[] = [];
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(Date.now() - i * 7 * 86400000);
      const k = weekKey(ref);
      const m = new Date(k);
      freqWeeks.push({
        label: `${m.getDate()}/${m.getMonth() + 1}`,
        value: freqBuckets[k] ?? 0,
        highlight: i === 0,
      });
    }
    setFreqBars(freqWeeks);

    // ── KPIs globaux ──────────────────────────────────────────────
    const sessions = (logsData ?? []).length;
    const totalSec = (logsData ?? []).reduce((a: number, l: any) => a + (l.duration_seconds ?? 0), 0);
    const totalXP  = (logsData ?? []).reduce((a: number, l: any) => a + (l.xp_earned ?? 0), 0);
    const totalTon = Math.round(tonWeeks.reduce((a, b) => a + b.value, 0) / 1000);
    setKpis({ sessions, avgMin: sessions > 0 ? Math.round(totalSec / sessions / 60) : 0, totalTon, totalXP });

    // ── Muscles ───────────────────────────────────────────────────
    setMuscleVolume((muscleData ?? []).map((m: any) => ({ id: m.muscle_id, pct: Math.round(m.volume_pct) })));

    // ── PRs ───────────────────────────────────────────────────────
    setPrs((prData ?? []) as any);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Courbe PR ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!prDetail) return;
    (async () => {
      setPrLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        let q = supabase
          .from('set_logs')
          .select('reps, weight_kg, completed_at, workout_logs!inner(user_id)')
          .eq('workout_logs.user_id', user.id)
          .eq('exercise_id', prDetail.exerciseId)
          .not('weight_kg', 'is', null)
          .order('completed_at', { ascending: true });

        if (prPeriod !== 'all') {
          const days = prPeriod === '30d' ? 30 : 180;
          q = q.gte('completed_at', new Date(Date.now() - days * 86400000).toISOString());
        }
        const { data } = await q;

        const best = new Map<string, number>();
        for (const s of (data ?? []) as any[]) {
          if (!s.weight_kg || !s.reps) continue;
          const day = (s.completed_at as string).split('T')[0];
          const orm = estimateOneRM(Number(s.weight_kg), Number(s.reps));
          best.set(day, Math.max(best.get(day) ?? 0, orm));
        }
        setPrChart(
          Array.from(best.entries()).map(([day, v]) => ({
            label: fmtDate(day),
            value: Math.round(v * 10) / 10,
          }))
        );
      } finally {
        setPrLoading(false);
      }
    })();
  }, [prDetail, prPeriod]);

  // ── Calculs dérivés ───────────────────────────────────────────────
  const thisWeekTon = tonBars[tonBars.length - 1]?.value ?? 0;
  const lastWeekTon = tonBars[tonBars.length - 2]?.value ?? 0;
  const tonDelta    = pct(thisWeekTon - lastWeekTon, lastWeekTon);
  const avgFreq     = freqBars.length > 0
    ? (freqBars.reduce((a, b) => a + b.value, 0) / freqBars.length).toFixed(1)
    : '0';
  const maxMuscle   = muscleVolume[0]?.pct ?? 0;

  // ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
      >
        {/* Titre */}
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
          Performances
        </Text>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatBadge icon="barbell-outline"  value={String(kpis.sessions)}  label="Séances"     sub={`moy. ${kpis.avgMin} min`}  colors={colors} />
          <StatBadge icon="flash-outline"    value={String(kpis.totalXP)}   label="XP gagnés"                                     colors={colors} />
          <StatBadge icon="scale-outline"    value={`${kpis.totalTon}t`}    label="Tonnage"     sub="12 semaines"                  colors={colors} />
          <StatBadge icon="trophy-outline"   value={String(prs.length)}     label="Records"                                        colors={colors} />
        </View>

        {/* Onglets */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4 }}>
          {([
            ['progress', '📈 Progression'],
            ['muscles',  '💪 Muscles'],
            ['records',  '🏆 Records'],
          ] as [Tab, string][]).map(([t, l]) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 9,
                backgroundColor: tab === t ? colors.surface2 : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: tab === t ? colors.text : colors.mute }}>
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ ONGLET PROGRESSION ═══════════════════════════════════ */}
        {tab === 'progress' && (
          <>
            {/* Poids corporel */}
            <SectionCard title="Poids corporel" sub="Depuis le suivi quotidien" colors={colors}>
              {/* Sélecteur période */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {(['2w', '1m', '3m', 'all'] as WeightPeriod[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setWeightPeriod(p)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                      backgroundColor: weightPeriod === p ? colors.accent : colors.surface2,
                      borderWidth: 1, borderColor: weightPeriod === p ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: weightPeriod === p ? colors.accentInk : colors.mute }}>
                      {WEIGHT_PERIOD_LABEL[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <LineChart data={weightSeries} unit=" kg" />
              {weightSeries.length < 2 && (
                <Text style={{ fontSize: 12, color: colors.mute, textAlign: 'center', marginTop: 4 }}>
                  Renseigne ton poids dans le suivi quotidien pour voir la courbe.
                </Text>
              )}
            </SectionCard>

            {/* Tonnage hebdomadaire */}
            <SectionCard title="Tonnage hebdomadaire" colors={colors}
              sub={tonDelta
                ? `Cette semaine : ${(thisWeekTon / 1000).toFixed(1)} t  ·  ${tonDelta} vs sem. dernière`
                : `${(thisWeekTon / 1000).toFixed(1)} t cette semaine`
              }
              subColor={tonDelta?.startsWith('+') ? colors.success : tonDelta?.startsWith('-') ? colors.danger : colors.mute}
            >
              <BarChart data={tonBars.map((b) => ({ ...b, value: Math.round(b.value / 100) / 10 }))} unit=" t" />
              <Text style={{ fontSize: 10, color: colors.mute, marginTop: 4, textAlign: 'right' }}>
                12 dernières semaines
              </Text>
            </SectionCard>

            {/* Fréquence */}
            <SectionCard title="Fréquence d'entraînement" sub={`Moy. ${avgFreq} séance${Number(avgFreq) > 1 ? 's' : ''}/semaine`} colors={colors}>
              <BarChart data={freqBars} unit=" s." />
              <Text style={{ fontSize: 10, color: colors.mute, marginTop: 4, textAlign: 'right' }}>
                12 dernières semaines
              </Text>
            </SectionCard>

            {/* Calendrier d'assiduité */}
            <SectionCard title="Assiduité" sub="28 derniers jours" colors={colors}>
              <AttendanceCalendar workoutDays={workoutDays} colors={colors} />
            </SectionCard>

            {/* Lien historique */}
            <TouchableOpacity
              onPress={() => router.push('/history' as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: colors.surface, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>
                Voir l'historique complet
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </>
        )}

        {/* ═══ ONGLET MUSCLES ══════════════════════════════════════ */}
        {tab === 'muscles' && (
          <>
            {muscleVolume.length === 0 ? (
              <SectionCard title="Volume musculaire" sub="Semaine en cours" colors={colors}>
                <View style={{ alignItems: 'center', gap: 10, padding: 16 }}>
                  <Text style={{ fontSize: 32 }}>💪</Text>
                  <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
                    Aucune donnée pour cette semaine.{'\n'}
                    Lance une séance pour alimenter l'analyse !
                  </Text>
                </View>
              </SectionCard>
            ) : (
              <>
                <SectionCard title="Volume par muscle" sub={`Semaine du ${weekStartStr()} · ${muscleVolume.length} muscles actifs`} colors={colors}>
                  {muscleVolume.map((m) => (
                    <MuscleBar
                      key={m.id}
                      name={MUSCLE_NAME[m.id] ?? m.id}
                      value={m.pct}
                      max={maxMuscle}
                      colors={colors}
                    />
                  ))}
                </SectionCard>

                {/* Groupes peu travaillés */}
                {(() => {
                  const worked = new Set(muscleVolume.map((m) => m.id));
                  const missed = Object.keys(MUSCLE_NAME).filter((id) => !worked.has(id));
                  if (missed.length === 0) return null;
                  return (
                    <SectionCard title="Muscles non travaillés" sub="Pense à les inclure cette semaine" colors={colors}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {missed.map((id) => (
                          <View key={id} style={{
                            backgroundColor: colors.surface2, borderRadius: 8,
                            paddingHorizontal: 10, paddingVertical: 5,
                            borderWidth: 1, borderColor: colors.border,
                          }}>
                            <Text style={{ fontSize: 12, color: colors.mute }}>{MUSCLE_NAME[id]}</Text>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* ═══ ONGLET RECORDS ══════════════════════════════════════ */}
        {tab === 'records' && (
          prs.length === 0 ? (
            <SectionCard title="Records personnels" colors={colors}>
              <View style={{ alignItems: 'center', gap: 10, padding: 16 }}>
                <Text style={{ fontSize: 32 }}>🏆</Text>
                <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center' }}>
                  Aucun PR pour l'instant.{'\n'}Entraîne-toi pour établir tes records !
                </Text>
              </View>
            </SectionCard>
          ) : (
            <>
              <Text style={{ fontSize: 12, color: colors.mute }}>
                Touche un exercice pour voir ta courbe de progression 1RM estimé.
              </Text>
              {prs.map((pr) => (
                <TouchableOpacity
                  key={pr.id}
                  activeOpacity={0.75}
                  onPress={() => {
                    setPrDetail({ exerciseId: pr.exercise_id, name: (pr as any).exercises?.name ?? 'Exercice' });
                    setPrPeriod('30d');
                  }}
                >
                  <View style={{
                    backgroundColor: colors.surface, borderRadius: 14,
                    borderWidth: 1, borderColor: colors.border,
                    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 10,
                      backgroundColor: `${colors.warn}20`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 18 }}>🏆</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {(pr as any).exercises?.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mute }}>
                        {new Date(pr.achieved_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                        {pr.weight_kg}kg × {pr.reps}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mute }}>
                        ≈ {pr.one_rm_kg?.toFixed(1)} kg 1RM
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mute} />
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )
        )}
      </ScrollView>

      {/* ══ Modal : progression 1RM ════════════════════════════════ */}
      <Modal
        visible={!!prDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setPrDetail(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface, padding: 20, paddingBottom: 36,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                {prDetail?.name}
              </Text>
              <TouchableOpacity onPress={() => setPrDetail(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.mute} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: colors.mute, marginBottom: 14 }}>
              Meilleur 1RM estimé (Epley) par jour d'entraînement
            </Text>

            {/* Sélecteur période */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, padding: 4, marginBottom: 14 }}>
              {(['30d', '6m', 'all'] as PRPeriod[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPrPeriod(p)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 9,
                    backgroundColor: prPeriod === p ? colors.accent : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: prPeriod === p ? colors.accentInk : colors.mute }}>
                    {PR_PERIOD_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {prLoading ? (
              <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : prChart.length < 2 ? (
              <View style={{ height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="analytics-outline" size={36} color={colors.mute} />
                <Text style={{ color: colors.mute, fontSize: 13, textAlign: 'center' }}>
                  Pas assez de séances sur cette période.
                </Text>
              </View>
            ) : (
              <LineChart data={prChart} unit=" kg" />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Carte de section réutilisable ─────────────────────────────────────
function SectionCard({
  title, sub, subColor, children, colors,
}: {
  title: string; sub?: string; subColor?: string; children: React.ReactNode; colors: any;
}) {
  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      padding: 16,
    }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: sub ? 2 : 10 }}>
        {title}
      </Text>
      {sub && (
        <Text style={{ fontSize: 11, color: subColor ?? colors.mute, marginBottom: 12 }}>
          {sub}
        </Text>
      )}
      {children}
    </View>
  );
}
