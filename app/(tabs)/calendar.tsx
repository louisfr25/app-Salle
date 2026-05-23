import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import type { Program, ProgramSession } from '../../lib/database.types';

const DAY_LABELS  = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTH_NAMES_LONG = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAY_NAMES_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

const SESSION_DAY_MAP: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
};

// ── Types ──────────────────────────────────────────────────────────────
type CalendarLog = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  program_sessions?: { name: string } | null;
};

interface ActiveProgram extends Program {
  program_sessions: ProgramSession[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

// ── Modal : détail d'un jour ───────────────────────────────────────────
function DayModal({
  visible,
  day,
  month,
  year,
  logs,
  plannedSession,
  onClose,
  colors,
  insets,
}: {
  visible: boolean;
  day: number;
  month: number;
  year: number;
  logs: CalendarLog[];
  plannedSession: ProgramSession | null;
  onClose: () => void;
  colors: any;
  insets: { bottom: number; top: number };
}) {
  const dow = (new Date(year, month, day).getDay() + 6) % 7;
  const dateLabel = `${DAY_NAMES_FR[dow]} ${day} ${MONTH_NAMES_LONG[month]} ${year}`;
  const isToday = (() => {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
  })();
  const isPast = new Date(year, month, day) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 16,
            borderWidth: 1, borderColor: colors.border,
          }}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{dateLabel}</Text>
              {isToday && (
                <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 2 }}>Aujourd'hui</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={22} color={colors.mute} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {/* Séances réalisées */}
            {logs.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {logs.length} séance{logs.length > 1 ? 's' : ''} réalisée{logs.length > 1 ? 's' : ''}
                </Text>
                {logs.map((log) => (
                  <TouchableOpacity
                    key={log.id}
                    onPress={() => { onClose(); setTimeout(() => router.push(`/history/${log.id}` as any), 200); }}
                    style={{
                      backgroundColor: colors.surface2,
                      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
                      padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: `${colors.success}20`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {log.program_sessions?.name ?? 'Séance libre'}
                      </Text>
                      {log.duration_seconds != null && (
                        <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>
                          {formatDuration(log.duration_seconds)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mute} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Séance planifiée non faite */}
            {plannedSession && logs.length === 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Planifiée
                </Text>
                <View style={{
                  backgroundColor: `${colors.accent}10`, borderRadius: 14,
                  borderWidth: 1, borderColor: `${colors.accent}30`, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{plannedSession.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>~{plannedSession.duration_min} min</Text>
                  </View>
                </View>
              </View>
            )}

            {/* CTA */}
            {!isPast || isToday ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                {plannedSession && logs.length === 0 && (
                  <TouchableOpacity
                    onPress={() => { onClose(); setTimeout(() => router.push({ pathname: '/train/active', params: { sessionId: plannedSession.id } }), 200); }}
                    style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="barbell-outline" size={18} color={colors.accentInk} />
                    <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
                      Lancer {plannedSession.name}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { onClose(); setTimeout(() => router.push('/train/active' as any), 200); }}
                  style={{
                    backgroundColor: plannedSession && logs.length === 0 ? colors.surface2 : colors.accent,
                    borderRadius: 14, padding: 14,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderWidth: plannedSession && logs.length === 0 ? 1 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={plannedSession && logs.length === 0 ? colors.text : colors.accentInk} />
                  <Text style={{ color: plannedSession && logs.length === 0 ? colors.text : colors.accentInk, fontWeight: '700', fontSize: 15 }}>
                    Séance libre
                  </Text>
                </TouchableOpacity>
              </View>
            ) : logs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
                <Text style={{ fontSize: 32 }}>😴</Text>
                <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center' }}>Journée de repos</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Écran principal ────────────────────────────────────────────────────
export default function CalendarScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs]             = useState<CalendarLog[]>([]);
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null);
  const [currentMonth, setCurrentMonth]   = useState(new Date());
  const [selectedDay, setSelectedDay]     = useState<number | null>(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => { loadData(); }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const end   = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('id, started_at, ended_at, duration_seconds, program_sessions(name)')
      .eq('user_id', user.id)
      .gte('started_at', start)
      .lte('started_at', end)
      .order('started_at', { ascending: false });

    setLogs((logsData ?? []) as CalendarLog[]);

    const { data: prog } = await supabase
      .from('programs')
      .select('*, program_sessions(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    if (prog) setActiveProgram(prog as ActiveProgram);

    setLoading(false);
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear()
    && today.getMonth() === currentMonth.getMonth();

  // Logs groupés par jour
  const logsByDay = new Map<number, CalendarLog[]>();
  for (const log of logs) {
    const d = new Date(log.started_at).getDate();
    if (!logsByDay.has(d)) logsByDay.set(d, []);
    logsByDay.get(d)!.push(log);
  }
  const workoutDays = new Set(logsByDay.keys());

  // Jours planifiés par le programme
  const plannedDays = new Set<number>();
  const plannedSessionByDay = new Map<number, ProgramSession>();
  if (activeProgram?.program_sessions && activeProgram.days_per_week) {
    const sessionDays = SESSION_DAY_MAP[activeProgram.days_per_week] ?? [];
    const sessions    = [...activeProgram.program_sessions].sort((a, b) => a.day_index - b.day_index);
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const dow     = (date.getDay() + 6) % 7;
      const slotIdx = sessionDays.indexOf(dow);
      if (slotIdx !== -1 && sessions[slotIdx]) {
        plannedDays.add(d);
        plannedSessionByDay.set(d, sessions[slotIdx]);
      }
    }
  }

  // Grille
  const firstDay   = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const cells       = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1
  );

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  // Séances à venir cette semaine
  const upcomingSessions: { dayLabel: string; session: ProgramSession; done: boolean }[] = [];
  if (activeProgram?.program_sessions && activeProgram.days_per_week) {
    const sessionDays = SESSION_DAY_MAP[activeProgram.days_per_week] ?? [];
    const sessions    = [...activeProgram.program_sessions].sort((a, b) => a.day_index - b.day_index);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow     = (d.getDay() + 6) % 7;
      const slotIdx = sessionDays.indexOf(dow);
      if (slotIdx !== -1 && sessions[slotIdx]) {
        const dayStr = d.toISOString().split('T')[0];
        const done   = logs.some((l) => l.started_at.startsWith(dayStr));
        const label  = i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : DAY_NAMES_FR[dow];
        upcomingSessions.push({ dayLabel: label, session: sessions[slotIdx], done });
      }
    }
  }

  // Données du jour sélectionné
  const selectedLogs      = selectedDay != null ? (logsByDay.get(selectedDay) ?? []) : [];
  const selectedPlanned   = selectedDay != null ? (plannedSessionByDay.get(selectedDay) ?? null) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Planning</Text>

        {/* ── Calendrier ── */}
        <Card padding={16}>
          {/* Navigation mois */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>
              {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Labels jours */}
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.mute }}>
                {d}
              </Text>
            ))}
          </View>

          {/* Grille — chaque jour est cliquable */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              const done    = workoutDays.has(day);
              const planned = plannedDays.has(day) && !done;
              const isToday = isCurrentMonth && day === today.getDate();

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDay(day)}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    flex: 1, borderRadius: 8,
                    backgroundColor: done ? colors.accent : isToday ? colors.surface2 : 'transparent',
                    borderWidth: planned ? 1.5 : isToday && !done ? 1 : 0,
                    borderColor: planned ? `${colors.accent}60` : colors.accent,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: isToday || done ? '800' : '400',
                      color: done ? colors.accentInk : isToday ? colors.accent : planned ? colors.accent : colors.text2,
                    }}>
                      {day}
                    </Text>
                    {planned && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, opacity: 0.6, position: 'absolute', bottom: 3 }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Légende */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[
              { color: colors.accent, label: 'Séance faite' },
              { color: `${colors.accent}60`, label: 'Planifiée', border: true },
            ].map((l) => (
              <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: l.border ? 'transparent' : l.color, borderWidth: l.border ? 1.5 : 0, borderColor: l.color }} />
                <Text style={{ fontSize: 11, color: colors.mute }}>{l.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Stats du mois ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Séances', value: logs.length },
            { label: 'Jours actifs', value: workoutDays.size },
            { label: 'Programme', value: activeProgram ? `${activeProgram.days_per_week}j/sem` : '—' },
          ].map((kpi) => (
            <Card key={kpi.label} style={{ flex: 1, alignItems: 'center' }} padding={14}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>{kpi.value}</Text>
              <Text style={{ fontSize: 10, color: colors.mute, marginTop: 2, textAlign: 'center' }}>{kpi.label}</Text>
            </Card>
          ))}
        </View>

        {/* ── Séances à venir cette semaine ── */}
        {upcomingSessions.length > 0 && (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Cette semaine
            </Text>
            <View style={{ gap: 10 }}>
              {upcomingSessions.map(({ dayLabel, session, done }, i) => (
                <Card key={i} padding={14}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: done ? colors.success : `${colors.accent}20`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={done ? 'checkmark-circle' : 'barbell-outline'} size={20} color={done ? '#fff' : colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: done ? colors.mute : colors.accent }}>{dayLabel}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: done ? colors.mute : colors.text }}>{session.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.mute }}>~{session.duration_min} min</Text>
                    </View>
                    {!done && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/train/active', params: { sessionId: session.id } })}
                        style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: colors.accentInk, fontWeight: '700', fontSize: 13 }}>Go →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* ── Historique du mois ── */}
        {logs.length > 0 && (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Historique
            </Text>
            <View style={{ gap: 8 }}>
              {logs.slice(0, 8).map((log) => (
                <TouchableOpacity
                  key={log.id}
                  onPress={() => router.push(`/history/${log.id}` as any)}
                  activeOpacity={0.75}
                >
                  <Card padding={14}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                            {log.program_sessions?.name ?? 'Séance libre'} ·{' '}
                            {new Date(log.started_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </Text>
                          {log.duration_seconds != null && (
                            <Text style={{ fontSize: 11, color: colors.mute, marginTop: 1 }}>
                              {formatDuration(log.duration_seconds)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mute} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!activeProgram && logs.length === 0 && (
          <Card padding={20} style={{ alignItems: 'center', gap: 12 }}>
            <Ionicons name="calendar-outline" size={48} color={colors.mute} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Aucun programme actif</Text>
            <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center' }}>
              Crée un programme pour voir tes séances planifiées ici
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/program/generate')}
              style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text style={{ color: colors.accentInk, fontWeight: '700' }}>Créer un programme</Text>
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>

      {/* ── Modal jour sélectionné ── */}
      {selectedDay != null && (
        <DayModal
          visible={selectedDay != null}
          day={selectedDay}
          month={currentMonth.getMonth()}
          year={currentMonth.getFullYear()}
          logs={selectedLogs}
          plannedSession={selectedPlanned}
          onClose={() => setSelectedDay(null)}
          colors={colors}
          insets={insets}
        />
      )}
    </SafeAreaView>
  );
}
