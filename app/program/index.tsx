/**
 * Écran "Mon programme" — visualisation + édition complète.
 *
 * Mode lecture : liste des séances avec leurs exercices + CTA démarrer.
 * Mode édition :
 *  - Renommer une séance
 *  - Réordonner les séances (↑ / ↓)
 *  - Supprimer une séance
 *  - Ajouter une séance vide
 *  - Réordonner les exercices dans une séance (↑ / ↓)
 *  - Modifier séries, répétitions et temps de repos par exercice
 *  - Supprimer un exercice
 *  - Ajouter un exercice (picker EXERCISE_LIBRARY)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  TextInput, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { EXERCISE_LIBRARY } from '../../constants/exercises';
import type { Program, ProgramSession, SessionExercise } from '../../lib/database.types';

// ── Types ─────────────────────────────────────────────────────────────
interface FullSessionExercise extends SessionExercise {
  exercises: { name: string; muscle_group: string };
}
interface FullSession extends ProgramSession {
  session_exercises: FullSessionExercise[];
}
interface FullProgram extends Program {
  program_sessions: FullSession[];
}

// ── Helper UUID ───────────────────────────────────────────────────────
const exIdToUUID = (exId: string): string | null => {
  const idx = EXERCISE_LIBRARY.findIndex((e) => e.id === exId);
  return idx === -1 ? null : `00000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
};

// ── Helper durée repos ─────────────────────────────────────────────────
function fmtRest(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m${r}s` : `${m}min`;
}

// ─────────────────────────────────────────────────────────────────────
// Composant : ligne d'exercice
// ─────────────────────────────────────────────────────────────────────
interface ExerciseRowProps {
  se: FullSessionExercise;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  colors: any;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (id: string, sets: number, reps: number, rest: number) => void;
  onRemove: (id: string) => void;
}

function ExerciseRow({ se, editMode, isFirst, isLast, colors, onMoveUp, onMoveDown, onUpdate, onRemove }: ExerciseRowProps) {
  const [sets, setSets]   = useState(String(se.sets));
  const [reps, setReps]   = useState(String(se.reps));
  const [rest, setRest]   = useState(String(se.rest_seconds));

  const save = () =>
    onUpdate(se.id, parseInt(sets) || se.sets, parseInt(reps) || se.reps, parseInt(rest) || se.rest_seconds);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 11,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      gap: 10,
    }}>
      {/* Contrôles édition (gauche) */}
      {editMode && (
        <View style={{ gap: 2 }}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={isFirst}
            style={{ padding: 3, opacity: isFirst ? 0.25 : 1 }}
          >
            <Ionicons name="chevron-up" size={15} color={colors.mute} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={isLast}
            style={{ padding: 3, opacity: isLast ? 0.25 : 1 }}
          >
            <Ionicons name="chevron-down" size={15} color={colors.mute} />
          </TouchableOpacity>
        </View>
      )}

      {/* Nom + muscle */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
          {se.exercises?.name ?? '—'}
        </Text>
        <Text style={{ fontSize: 11, color: colors.mute }}>{se.exercises?.muscle_group}</Text>
      </View>

      {/* Séries × reps × repos */}
      {editMode ? (
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {/* Séries */}
          <NumInput value={sets} onChange={setSets} onBlur={save} colors={colors} label="s" />
          <Text style={{ color: colors.mute, fontSize: 11 }}>×</Text>
          {/* Reps */}
          <NumInput value={reps} onChange={setReps} onBlur={save} colors={colors} label="r" />
          <Text style={{ color: colors.mute, fontSize: 11 }}>·</Text>
          {/* Repos */}
          <NumInput value={rest} onChange={setRest} onBlur={save} colors={colors} label="s" width={44} />
        </View>
      ) : (
        <View style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 2 }}>
          <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700', textAlign: 'center' }}>
            {se.sets} × {se.reps}
          </Text>
          <Text style={{ fontSize: 10, color: colors.mute, textAlign: 'center' }}>
            {fmtRest(se.rest_seconds)}
          </Text>
        </View>
      )}

      {/* Supprimer (mode édition) */}
      {editMode && (
        <TouchableOpacity onPress={() => onRemove(se.id)} style={{ padding: 4 }}>
          <Ionicons name="remove-circle" size={20} color={colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Petit champ numérique réutilisable
function NumInput({ value, onChange, onBlur, colors, label, width = 36 }: any) {
  return (
    <View style={{ alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        keyboardType="number-pad"
        style={{
          width, backgroundColor: colors.surface2,
          borderRadius: 8, borderWidth: 1, borderColor: colors.border,
          padding: 5, color: colors.text,
          textAlign: 'center', fontSize: 13, fontWeight: '700',
        }}
      />
      <Text style={{ fontSize: 9, color: colors.mute, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────
export default function ProgramScreen() {
  const colors = useTheme();
  const [program, setProgram]           = useState<FullProgram | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  // Picker d'exercice
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [pickerFilter, setPickerFilter]       = useState('');

  // Modale renommage séance
  const [renameId, setRenameId]       = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameDuration, setRenameDuration] = useState('');

  // ── Chargement ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data } = await supabase
      .from('programs')
      .select('*, program_sessions(*, session_exercises(*, exercises(name, muscle_group)))')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    setProgram(data as FullProgram ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Réordonnement séances ─────────────────────────────────────────
  const moveSession = async (sessionId: string, direction: 'up' | 'down') => {
    if (!program) return;
    const sorted = [...program.program_sessions].sort((a, b) => a.day_index - b.day_index);
    const idx = sorted.findIndex((s) => s.id === sessionId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];

    setSaving(true);
    await Promise.all([
      supabase.from('program_sessions').update({ day_index: b.day_index }).eq('id', a.id),
      supabase.from('program_sessions').update({ day_index: a.day_index }).eq('id', b.id),
    ]);
    await load();
    setSaving(false);
  };

  // ── Réordonnement exercices ───────────────────────────────────────
  const moveExercise = async (sessionId: string, seId: string, direction: 'up' | 'down') => {
    if (!program) return;
    const sess = program.program_sessions.find((s) => s.id === sessionId);
    if (!sess) return;
    const sorted = [...sess.session_exercises].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex((s) => s.id === seId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];

    setSaving(true);
    await Promise.all([
      supabase.from('session_exercises').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('session_exercises').update({ order_index: a.order_index }).eq('id', b.id),
    ]);
    await load();
    setSaving(false);
  };

  // ── Renommage séance ──────────────────────────────────────────────
  const openRename = (s: FullSession) => {
    setRenameId(s.id);
    setRenameDraft(s.name);
    setRenameDuration(String(s.duration_min));
  };

  const saveRename = async () => {
    if (!renameId) return;
    const name = renameDraft.trim();
    if (!name) { Alert.alert('Nom invalide', 'Le nom ne peut pas être vide.'); return; }
    setSaving(true);
    await supabase.from('program_sessions').update({
      name,
      duration_min: parseInt(renameDuration) || 45,
    }).eq('id', renameId);
    setRenameId(null);
    await load();
    setSaving(false);
  };

  // ── Supprimer séance ──────────────────────────────────────────────
  const deleteSession = (sessionId: string) => {
    Alert.alert('Supprimer cette séance ?', 'Les exercices associés seront aussi supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          await supabase.from('program_sessions').delete().eq('id', sessionId);
          if (expandedId === sessionId) setExpandedId(null);
          await load();
          setSaving(false);
        },
      },
    ]);
  };

  // ── Ajouter une séance ────────────────────────────────────────────
  const addSession = async () => {
    if (!program) return;
    const maxDay = program.program_sessions.length > 0
      ? Math.max(...program.program_sessions.map((s) => s.day_index))
      : -1;
    setSaving(true);
    const { data } = await supabase.from('program_sessions').insert({
      program_id:   program.id,
      name:         `Séance ${maxDay + 2}`,
      day_index:    maxDay + 1,
      duration_min: 45,
    }).select().single();
    if (data) setExpandedId(data.id);
    await load();
    setSaving(false);
  };

  // ── Modifier séries / reps / repos ───────────────────────────────
  const updateExercise = async (seId: string, sets: number, reps: number, rest: number) => {
    await supabase.from('session_exercises').update({ sets, reps, rest_seconds: rest }).eq('id', seId);
  };

  // ── Supprimer exercice ────────────────────────────────────────────
  const removeExercise = async (seId: string) => {
    setSaving(true);
    await supabase.from('session_exercises').delete().eq('id', seId);
    await load();
    setSaving(false);
  };

  // ── Sélection exercice → ouvre la config avant d'ajouter ─────────
  const [pendingEx, setPendingEx] = useState<{
    sessionId: string; exLibId: string;
    name: string; sets: number; reps: number; rest: number;
  } | null>(null);
  const [pendingSets, setPendingSets] = useState('');
  const [pendingReps, setPendingReps] = useState('');
  const [pendingRest, setPendingRest] = useState('');

  const selectExercise = (sessionId: string, exLibId: string) => {
    const lib = EXERCISE_LIBRARY.find((e) => e.id === exLibId);
    if (!lib) return;
    setPickerSessionId(null);
    setPickerFilter('');
    setPendingSets(String(lib.defaultSets));
    setPendingReps(String(lib.defaultReps));
    setPendingRest(String(lib.defaultRest));
    setPendingEx({ sessionId, exLibId, name: lib.name, sets: lib.defaultSets, reps: lib.defaultReps, rest: lib.defaultRest });
  };

  // ── Ajouter exercice (après config) ──────────────────────────────
  const addExercise = async () => {
    if (!pendingEx) return;
    const uuid = exIdToUUID(pendingEx.exLibId);
    if (!uuid) return;

    const sess = program?.program_sessions.find((s) => s.id === pendingEx.sessionId);
    const maxOrder = sess
      ? Math.max(-1, ...sess.session_exercises.map((se) => se.order_index))
      : -1;

    const sets = Math.max(1, parseInt(pendingSets) || pendingEx.sets);
    const reps = Math.max(1, parseInt(pendingReps) || pendingEx.reps);
    const rest = Math.max(15, parseInt(pendingRest) || pendingEx.rest);

    setSaving(true);
    await supabase.from('session_exercises').insert({
      session_id:   pendingEx.sessionId,
      exercise_id:  uuid,
      order_index:  maxOrder + 1,
      sets, reps,
      rest_seconds: rest,
    });
    setPendingEx(null);
    await load();
    setSaving(false);
  };

  // ── Activer le programme ──────────────────────────────────────────
  const activateProgram = async () => {
    if (!program) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('programs').update({ is_active: false }).eq('user_id', session.user.id);
    await supabase.from('programs').update({ is_active: true }).eq('id', program.id);
    setProgram((p) => p ? { ...p, is_active: true } : p);
  };

  // ── Exercices filtrés pour le picker ──────────────────────────────
  const filteredExercises = EXERCISE_LIBRARY.filter((e) =>
    !pickerFilter ||
    e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
    e.muscleGroup.toLowerCase().includes(pickerFilter.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0B', justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
            Aucun programme actif
          </Text>
          <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
            Génère un programme avec l'IA ou crée-le à la main.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/program/generate' as any)}
            style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
              ✨ Créer un programme
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sortedSessions = [...program.program_sessions].sort((a, b) => a.day_index - b.day_index);
  const totalExercises = sortedSessions.reduce((n, s) => n + s.session_exercises.length, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
      >
        {/* ── En-tête ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }} numberOfLines={1}>
              {program.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mute }}>
              {program.days_per_week}j/sem · {sortedSessions.length} séances · {totalExercises} exos
              {program.source === 'ai' ? ' · ✨ IA' : ''}
            </Text>
          </View>

          {/* Bouton édition + spinner */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {saving && <ActivityIndicator size="small" color={colors.accent} />}
            <TouchableOpacity
              onPress={() => setEditMode((e) => !e)}
              style={{
                backgroundColor: editMode ? colors.accent : colors.surface2,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                borderWidth: 1, borderColor: editMode ? colors.accent : colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: editMode ? colors.accentInk : colors.text }}>
                {editMode ? '✓ Terminer' : '✏️ Modifier'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bandeau programme actif ── */}
        {program.is_active ? (
          <View style={{
            backgroundColor: `${colors.accent}15`, borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: `${colors.accent}30`,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13, flex: 1 }}>Programme actif</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={activateProgram}
            style={{
              backgroundColor: colors.surface, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: colors.border, alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>
              Activer ce programme
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Séances ── */}
        {sortedSessions.map((session, sIdx) => {
          const isOpen   = expandedId === session.id;
          const isFirst  = sIdx === 0;
          const isLastS  = sIdx === sortedSessions.length - 1;
          const sortedEx = [...session.session_exercises].sort((a, b) => a.order_index - b.order_index);

          return (
            <View
              key={session.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {/* En-tête séance */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                {/* Boutons ↑↓ en mode édition */}
                {editMode && (
                  <View style={{ gap: 2 }}>
                    <TouchableOpacity
                      onPress={() => moveSession(session.id, 'up')}
                      disabled={isFirst}
                      style={{ padding: 3, opacity: isFirst ? 0.25 : 1 }}
                    >
                      <Ionicons name="chevron-up" size={16} color={colors.mute} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveSession(session.id, 'down')}
                      disabled={isLastS}
                      style={{ padding: 3, opacity: isLastS ? 0.25 : 1 }}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.mute} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Badge jour */}
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: `${colors.accent}20`,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>
                    J{session.day_index + 1}
                  </Text>
                </View>

                {/* Nom + infos */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => editMode ? openRename(session) : setExpandedId(isOpen ? null : session.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                      {session.name}
                    </Text>
                    {editMode && (
                      <Ionicons name="pencil-outline" size={13} color={colors.mute} />
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: colors.mute, marginTop: 1 }}>
                    {sortedEx.length} exercice{sortedEx.length > 1 ? 's' : ''} · {session.duration_min} min
                  </Text>
                </TouchableOpacity>

                {/* Icône poubelle en mode édition */}
                {editMode ? (
                  <TouchableOpacity onPress={() => deleteSession(session.id)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setExpandedId(isOpen ? null : session.id)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mute} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Corps séance (déplié) */}
              {isOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  {/* Légende en mode édition */}
                  {editMode && sortedEx.length > 0 && (
                    <View style={{
                      flexDirection: 'row', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2,
                      justifyContent: 'flex-end', gap: 5,
                    }}>
                      {['sér.', 'rép.', 'repos'].map((l) => (
                        <Text key={l} style={{ fontSize: 9, color: colors.mute, width: l === 'repos' ? 44 : 36, textAlign: 'center' }}>
                          {l}
                        </Text>
                      ))}
                      <View style={{ width: 28 }} />
                    </View>
                  )}

                  {sortedEx.map((se, exIdx) => (
                    <ExerciseRow
                      key={se.id}
                      se={se}
                      editMode={editMode}
                      isFirst={exIdx === 0}
                      isLast={exIdx === sortedEx.length - 1}
                      colors={colors}
                      onMoveUp={() => moveExercise(session.id, se.id, 'up')}
                      onMoveDown={() => moveExercise(session.id, se.id, 'down')}
                      onUpdate={updateExercise}
                      onRemove={removeExercise}
                    />
                  ))}

                  {/* Ajouter exercice (mode édition) */}
                  {editMode && (
                    <TouchableOpacity
                      onPress={() => setPickerSessionId(session.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 8,
                        margin: 12, padding: 12, borderRadius: 12,
                        backgroundColor: `${colors.accent}10`,
                        borderWidth: 1.5, borderColor: `${colors.accent}35`,
                        borderStyle: 'dashed',
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>
                        Ajouter un exercice
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Démarrer séance (mode lecture) */}
                  {!editMode && (
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/train/active', params: { sessionId: session.id } })}
                      style={{ margin: 12, backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' }}
                    >
                      <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
                        Démarrer cette séance →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* ── Ajouter une séance (mode édition) ── */}
        {editMode && (
          <TouchableOpacity
            onPress={addSession}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              backgroundColor: colors.surface,
              borderRadius: 16, padding: 16,
              borderWidth: 1.5, borderColor: colors.border,
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>
              Nouvelle séance
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ══ Modal : picker d'exercice ══════════════════════════════════ */}
      <Modal
        visible={pickerSessionId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setPickerSessionId(null); setPickerFilter(''); }}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', padding: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>
              Ajouter un exercice
            </Text>
            <TouchableOpacity onPress={() => { setPickerSessionId(null); setPickerFilter(''); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 12 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: colors.surface, borderRadius: 12,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 12, paddingVertical: 10,
            }}>
              <Ionicons name="search-outline" size={18} color={colors.mute} />
              <TextInput
                value={pickerFilter}
                onChangeText={setPickerFilter}
                placeholder="Exercice ou groupe musculaire…"
                placeholderTextColor={colors.mute}
                style={{ flex: 1, color: colors.text, fontSize: 14 }}
                autoFocus
              />
              {pickerFilter !== '' && (
                <TouchableOpacity onPress={() => setPickerFilter('')}>
                  <Ionicons name="close-circle" size={18} color={colors.mute} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredExercises}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
            renderItem={({ item: ex }) => (
              <TouchableOpacity
                onPress={() => pickerSessionId && selectExercise(pickerSessionId, ex.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: colors.surface, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border, padding: 14,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 10,
                  backgroundColor: `${colors.accent}20`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="barbell-outline" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{ex.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.mute }}>
                    {ex.muscleGroup} · {ex.defaultSets}×{ex.defaultReps} · {fmtRest(ex.defaultRest)} repos
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ══ Modal : config exercice avant ajout ════════════════════════ */}
      <Modal
        visible={pendingEx !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingEx(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: colors.border, gap: 16 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{pendingEx?.name}</Text>
              <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>Configure cet exercice avant de l'ajouter</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Séries */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Séries</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  <TouchableOpacity onPress={() => setPendingSets((v) => String(Math.max(1, (parseInt(v) || 1) - 1)))} style={{ padding: 12 }}>
                    <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '800' }}>−</Text>
                  </TouchableOpacity>
                  <TextInput value={pendingSets} onChangeText={setPendingSets} keyboardType="number-pad" style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '800' }} />
                  <TouchableOpacity onPress={() => setPendingSets((v) => String((parseInt(v) || 1) + 1))} style={{ padding: 12 }}>
                    <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '800' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Répétitions */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Répétitions</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  <TouchableOpacity onPress={() => setPendingReps((v) => String(Math.max(1, (parseInt(v) || 1) - 1)))} style={{ padding: 12 }}>
                    <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '800' }}>−</Text>
                  </TouchableOpacity>
                  <TextInput value={pendingReps} onChangeText={setPendingReps} keyboardType="number-pad" style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '800' }} />
                  <TouchableOpacity onPress={() => setPendingReps((v) => String((parseInt(v) || 1) + 1))} style={{ padding: 12 }}>
                    <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '800' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Repos */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Temps de repos</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[30, 45, 60, 90, 120, 180].map((s) => {
                  const active = parseInt(pendingRest) === s;
                  return (
                    <TouchableOpacity key={s} onPress={() => setPendingRest(String(s))}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: active ? colors.accent : colors.surface2, borderWidth: 1, borderColor: active ? colors.accent : colors.border }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.accentInk : colors.text }}>{fmtRest(s)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setPendingEx(null)}
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addExercise}
                style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' }}>
                <Text style={{ color: colors.accentInk, fontWeight: '800' }}>
                  Ajouter — {pendingSets}×{pendingReps} · {fmtRest(parseInt(pendingRest) || 60)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal : renommage séance ════════════════════════════════════ */}
      <Modal
        visible={renameId !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setRenameId(null)}
      >
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 20, padding: 24, width: '100%',
            borderWidth: 1, borderColor: colors.border, gap: 16,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              Renommer la séance
            </Text>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Nom
              </Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                maxLength={50}
                autoFocus
                style={{
                  backgroundColor: colors.surface2, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  padding: 13, color: colors.text, fontSize: 15,
                }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Durée estimée (min)
              </Text>
              <TextInput
                value={renameDuration}
                onChangeText={setRenameDuration}
                keyboardType="number-pad"
                style={{
                  backgroundColor: colors.surface2, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  padding: 13, color: colors.text, fontSize: 15,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setRenameId(null)}
                style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveRename}
                style={{ flex: 2, padding: 13, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentInk, fontWeight: '800' }}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
