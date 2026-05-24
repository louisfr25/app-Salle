import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, AppState, ActivityIndicator,
  Modal, FlatList, Image,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useWorkoutStore, type ActiveExercise } from '../../lib/store/useWorkoutStore';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { finalizeWorkout, type WorkoutResult } from '../../lib/gamification';
import { scheduleRestEnd, cancelNotification } from '../../lib/notifications';
import { playRestEndSound } from '../../lib/sound';
import { EXERCISE_LIBRARY } from '../../constants/exercises';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Card } from '../../components/ui/Card';
import { uploadWorkoutPhoto, deleteWorkoutPhoto, type WorkoutPhoto } from '../../lib/workoutPhotos';
import type { SessionExercise, SetLog, Profile } from '../../lib/database.types';

// Maps an EXERCISE_LIBRARY string id to the deterministic Supabase UUID
// (the exercises table is seeded in library order).
const exIdToUUID = (exId: string): string => {
  const idx = EXERCISE_LIBRARY.findIndex((e) => e.id === exId);
  if (idx === -1) return '';
  return `00000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
};

export default function ActiveWorkoutScreen() {
  const colors = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const {
    exercises,
    currentExerciseIndex,
    currentSetIndex,
    setExercises,
    addExercise,
    setExerciseRest,
    goToExercise,
    updateSet,
    completeSet,
    elapsedSeconds,
    setElapsed,
    isResting,
    restSeconds,
    startRest,
    stopRest,
    reset,
  } = useWorkoutStore();

  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<WorkoutResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Photo de séance
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState<WorkoutPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const elapsedRef      = useRef(elapsedSeconds);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const restNotifId     = useRef<string | null>(null);
  const restRemainingRef = useRef(restSeconds);   // ref pour modifier depuis +30s
  const restTotalRef    = useRef(restSeconds);    // durée initiale (pour l'arc)
  const [restRemaining, setRestRemaining] = useState(restSeconds);

  // Load session
  useEffect(() => {
    initWorkout();
    return () => {
      clearInterval(timerRef.current!);
      clearInterval(restRef.current!);
      cancelNotification(restNotifId.current);
    };
  }, []);

  const initWorkout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    setCurrentUserId(user.id);

    // Create workout log
    const { data: log } = await supabase
      .from('workout_logs')
      .insert({ user_id: user.id, program_session_id: sessionId ?? null, started_at: new Date().toISOString() })
      .select()
      .single();
    setWorkoutLogId(log?.id ?? null);

    // Load exercises
    if (sessionId) {
      const { data: se } = await supabase
        .from('session_exercises')
        .select('*, exercises(*)')
        .eq('session_id', sessionId)
        .order('order_index');

      if (se) {
        const activeExercises = await Promise.all(
          se.map(async (s: any) => {
            // Load previous sets
            const { data: prev } = await supabase
              .from('set_logs')
              .select('reps, weight_kg')
              .eq('exercise_id', s.exercise_id)
              .order('completed_at', { ascending: false })
              .limit(s.sets);

            return {
              sessionExercise: s as SessionExercise,
              exerciseName: s.exercises?.name ?? '',
              sets: Array.from({ length: s.sets }, (_, i) => ({
                setIndex: i,
                reps: s.reps,
                weight: null,
                completed: false,
                isResting: false,
              })),
              previousSets: (prev ?? []).reverse().map((p: any) => ({
                reps: p.reps,
                weight: p.weight_kg,
              })),
            };
          })
        );
        setExercises(activeExercises);
      }
    }

    setLoading(false);

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  };

  const addExerciseFromLibrary = (libId: string) => {
    const lib = EXERCISE_LIBRARY.find((e) => e.id === libId);
    if (!lib) return;
    const uuid = exIdToUUID(libId);
    const synthetic: SessionExercise = {
      id: `free-${libId}-${Date.now()}`,
      session_id: '',
      exercise_id: uuid,
      order_index: exercises.length,
      sets: lib.defaultSets,
      reps: lib.defaultReps,
      rest_seconds: lib.defaultRest,
      notes: null,
    };
    const newEx: ActiveExercise = {
      sessionExercise: synthetic,
      exerciseName: lib.name,
      sets: Array.from({ length: lib.defaultSets }, (_, i) => ({
        setIndex: i,
        reps: lib.defaultReps,
        weight: null,
        completed: false,
        isResting: false,
      })),
      previousSets: [],
    };
    addExercise(newEx);
    setPickerOpen(false);
    setSearch('');
  };

  const filteredLibrary = EXERCISE_LIBRARY.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
  });

  const handlePickPhoto = async (source: 'camera' | 'gallery') => {
    if (sessionPhotos.length >= 2) {
      Alert.alert('Maximum atteint', '2 photos maximum par séance 💪');
      return;
    }
    if (!currentUserId || !workoutLogId) {
      Alert.alert('Erreur', 'La séance n\'est pas encore initialisée.');
      return;
    }

    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorise l\'accès dans les réglages de ton téléphone.');
      return;
    }

    const picked = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          quality: 0.8,
          aspect: [4, 3],
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });

    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    const uri = picked.assets[0].uri;
    setPhotoUploading(true);
    try {
      const photo = await uploadWorkoutPhoto(currentUserId, workoutLogId, uri);
      if (photo) {
        // URI locale pour affichage immédiat pendant la séance
        setSessionPhotos((prev) => [...prev, { ...photo, signedUrl: uri }]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          'Upload échoué',
          'La photo n\'a pas pu être envoyée. Vérifie ta connexion et réessaie.',
        );
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'uploader la photo, réessaie.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: WorkoutPhoto) => {
    Alert.alert('Supprimer la photo ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await deleteWorkoutPhoto(photo);
          setSessionPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        },
      },
    ]);
  };

  const handleCompleteSet = async (exIdx: number, setIdx: number) => {
    const ex = exercises[exIdx];
    const set = ex.sets[setIdx];
    if (!workoutLogId) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Log to DB
    await supabase.from('set_logs').insert({
      workout_log_id: workoutLogId,
      exercise_id: ex.sessionExercise.exercise_id,
      set_index: setIdx,
      reps: set.reps,
      weight_kg: set.weight ?? undefined,
      completed_at: new Date().toISOString(),
    } as any);

    completeSet(exIdx, setIdx);

    // Auto-start rest
    const restDuration = ex.sessionExercise.rest_seconds ?? 90;
    restRemainingRef.current = restDuration;
    restTotalRef.current     = restDuration;
    setRestRemaining(restDuration);
    startRest(restDuration);

    scheduleRestEnd(restDuration).then((id) => { restNotifId.current = id; });

    clearInterval(restRef.current!);
    restRef.current = setInterval(() => {
      restRemainingRef.current -= 1;
      setRestRemaining(restRemainingRef.current);
      if (restRemainingRef.current <= 0) {
        clearInterval(restRef.current!);
        stopRest();
        cancelNotification(restNotifId.current);
        restNotifId.current = null;
        playRestEndSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 250);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 550);
      }
    }, 1000);
  };

  // Ajouter 30 secondes au repos en cours
  const handleAdd30 = () => {
    restRemainingRef.current += 30;
    setRestRemaining(restRemainingRef.current);
  };

  const handleFinishWorkout = async () => {
    if (!workoutLogId || finishing) return;
    setFinishing(true);
    try {
      const duration = elapsedRef.current;
      await supabase
        .from('workout_logs')
        .update({ ended_at: new Date().toISOString(), duration_seconds: duration })
        .eq('id', workoutLogId);

      clearInterval(timerRef.current!);
      clearInterval(restRef.current!);

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const res = await finalizeWorkout(user.id, workoutLogId);
        setResult(res);
        // Refresh cached profile so dashboard / profile show fresh XP & streak
        const { data: fresh } = await supabase
          .from('profiles').select('*').eq('id', user.id).single();
        if (fresh) useAppStore.getState().setProfile(fresh as Profile);
      } else {
        // No session — just leave
        reset();
        router.replace('/(tabs)');
      }
    } catch {
      reset();
      router.replace('/(tabs)');
    } finally {
      setFinishing(false);
    }
  };

  const dismissResult = () => {
    setResult(null);
    reset();
    router.replace('/(tabs)');
  };

  const confirmFinish = () => {
    Alert.alert('Terminer la séance ?', 'Ton entraînement sera sauvegardé.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Terminer', style: 'destructive', onPress: handleFinishWorkout },
    ]);
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text }}>Chargement…</Text>
      </View>
    );
  }

  const currentEx = exercises[currentExerciseIndex];
  const progress = exercises.length > 0
    ? exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0) /
      exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={confirmFinish} style={{ padding: 4 }}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Terminer</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 18, fontWeight: '700' }}>
          {fmtTime(elapsedSeconds)}
        </Text>
        {/* Camera button */}
        <TouchableOpacity
          onPress={() => setPhotoModalOpen(true)}
          style={{ width: 60, alignItems: 'flex-end' }}
        >
          <View style={{ position: 'relative' }}>
            <Ionicons name="camera-outline" size={26} color={sessionPhotos.length > 0 ? colors.accent : colors.mute} />
            {sessionPhotos.length > 0 && (
              <View style={{
                position: 'absolute', top: -4, right: -6,
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.accentInk }}>
                  {sessionPhotos.length}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ProgressBar value={progress} />
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4 }}>
          {exercises.length > 0 && `${currentExerciseIndex + 1} / ${exercises.length} exercices`}
        </Text>
      </View>

      {/* ── Rest overlay — cercle SVG animé ──────────────────────── */}
      {isResting && (
        <RestTimerOverlay
          remaining={restRemaining}
          total={restTotalRef.current}
          colors={colors}
          onSkip={() => {
            clearInterval(restRef.current!);
            stopRest();
            cancelNotification(restNotifId.current);
            restNotifId.current = null;
          }}
          onAdd30={handleAdd30}
        />
      )}

      {/* ── Bannière photo ─────────────────────────────────────────── */}
      {sessionPhotos.length < 2 && workoutLogId && (
        <TouchableOpacity
          onPress={() => setPhotoModalOpen(true)}
          activeOpacity={0.8}
          style={{
            marginHorizontal: 16, marginBottom: 10,
            backgroundColor: `${colors.accent}18`,
            borderRadius: 14, borderWidth: 1, borderColor: `${colors.accent}40`,
            paddingVertical: 10, paddingHorizontal: 14,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}
        >
          <Text style={{ fontSize: 20 }}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>
              Immortalise ta séance !
            </Text>
            <Text style={{ fontSize: 11, color: colors.mute, marginTop: 1 }}>
              {sessionPhotos.length === 0 ? 'Prends une photo pour suivre ta progression' : '1 photo prise · ajoutes-en une autre 💪'}
            </Text>
          </View>
          <Ionicons name="camera" size={20} color={colors.accent} />
        </TouchableOpacity>
      )}

      {/* Exercise navigator */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingLeft: 16, marginBottom: 12 }}>
        {exercises.map((ex, i) => {
          const done = ex.sets.every((s) => s.completed);
          const active = i === currentExerciseIndex;
          return (
            <TouchableOpacity
              key={ex.sessionExercise.id}
              onPress={() => goToExercise(i)}
              style={{
                marginRight: 8,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: active ? colors.accent : done ? colors.surface3 : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.accentInk : done ? colors.mute : colors.text }}>
                {ex.exerciseName}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{
            marginRight: 16, paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 12, backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.accent,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}
        >
          <Ionicons name="add" size={14} color={colors.accent} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>Exercice</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Current exercise sets */}
      {currentEx && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
            {currentEx.exerciseName}
          </Text>

          {/* Rest time editor (per exercise — works for free sessions too) */}
          <Card padding={12} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="timer-outline" size={16} color={colors.mute} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text2 }}>Temps de repos</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setExerciseRest(currentExerciseIndex, (currentEx.sessionExercise.rest_seconds ?? 90) - 15)}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accent, minWidth: 54, textAlign: 'center' }}>
                  {currentEx.sessionExercise.rest_seconds ?? 90}s
                </Text>
                <TouchableOpacity
                  onPress={() => setExerciseRest(currentExerciseIndex, (currentEx.sessionExercise.rest_seconds ?? 90) + 15)}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[45, 60, 90, 120, 180].map((p) => {
                const active = (currentEx.sessionExercise.rest_seconds ?? 90) === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setExerciseRest(currentExerciseIndex, p)}
                    style={{
                      flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center',
                      backgroundColor: active ? colors.accent : colors.surface2,
                      borderWidth: 1, borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.accentInk : colors.mute }}>
                      {p}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {currentEx.sets.map((set, si) => {
            const prev = currentEx.previousSets?.[si];
            return (
              <Card key={si} padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: set.completed ? colors.success : colors.surface2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: set.completed ? '#fff' : colors.mute }}>
                    {si + 1}
                  </Text>
                </View>

                {/* Previous */}
                <View style={{ width: 56 }}>
                  <Text style={{ fontSize: 10, color: colors.mute }}>Précédent</Text>
                  <Text style={{ fontSize: 11, color: colors.text2, fontWeight: '500' }}>
                    {prev ? `${prev.weight}kg×${prev.reps}` : '--'}
                  </Text>
                </View>

                {/* Weight input */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 2 }}>Poids (kg)</Text>
                  <TextInput
                    value={set.weight?.toString() ?? ''}
                    onChangeText={(t) => {
                      const n = parseFloat(t);
                      updateSet(currentExerciseIndex, si, { weight: t.trim() === '' || isNaN(n) ? null : n });
                    }}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.surface2, borderRadius: 8,
                      borderWidth: 1, borderColor: colors.border,
                      padding: 8, textAlign: 'center',
                      color: colors.text, fontSize: 16, fontWeight: '700',
                      width: 70,
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.mute}
                  />
                </View>

                {/* Reps input */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: colors.mute, marginBottom: 2 }}>Reps</Text>
                  <TextInput
                    value={set.reps?.toString() ?? ''}
                    onChangeText={(t) => updateSet(currentExerciseIndex, si, { reps: parseInt(t) || null })}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: colors.surface2, borderRadius: 8,
                      borderWidth: 1, borderColor: colors.border,
                      padding: 8, textAlign: 'center',
                      color: colors.text, fontSize: 16, fontWeight: '700',
                      width: 60,
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.mute}
                  />
                </View>

                {/* Complete button */}
                <TouchableOpacity
                  onPress={() => !set.completed && handleCompleteSet(currentExerciseIndex, si)}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: set.completed ? colors.success : colors.accent,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: set.completed ? '#fff' : colors.accentInk, fontSize: 18 }}>✓</Text>
                </TouchableOpacity>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {exercises.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Ionicons name="barbell-outline" size={48} color={colors.mute} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
            Séance libre
          </Text>
          <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center' }}>
            Ajoute les exercices que tu veux faire aujourd'hui.
          </Text>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={{
              backgroundColor: colors.accent, borderRadius: 14,
              paddingHorizontal: 24, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Ionicons name="add" size={18} color={colors.accentInk} />
            <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
              Ajouter un exercice
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Photo modal ─────────────────────────────────────────────── */}
      <Modal visible={photoModalOpen} animationType="slide" transparent onRequestClose={() => setPhotoModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: `${colors.bg}F0`, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: 40,
            borderWidth: 1, borderColor: colors.border,
            gap: 20,
          }}>
            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>📸 Photos de séance</Text>
                <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>
                  {sessionPhotos.length}/2 photo{sessionPhotos.length > 1 ? 's' : ''} — Oublie pas de flex 💪
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPhotoModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.mute} />
              </TouchableOpacity>
            </View>

            {/* Photo slots */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[0, 1].map((slot) => {
                const photo = sessionPhotos[slot];
                return (
                  <View key={slot} style={{ flex: 1, aspectRatio: 1 }}>
                    {photo ? (
                      <TouchableOpacity
                        onLongPress={() => handleDeletePhoto(photo)}
                        activeOpacity={0.85}
                        style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
                      >
                        <Image
                          source={{ uri: photo.signedUrl ?? photo.storage_path }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        {/* Delete hint */}
                        <View style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          backgroundColor: 'rgba(0,0,0,0.45)',
                          paddingVertical: 6, alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
                        }}>
                          <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>Maintenir pour supprimer</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={{
                        flex: 1, borderRadius: 16,
                        borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                        backgroundColor: colors.surface2,
                      }}>
                        <Ionicons name="image-outline" size={32} color={colors.mute} />
                        <Text style={{ fontSize: 11, color: colors.mute }}>Photo {slot + 1}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Action buttons */}
            {sessionPhotos.length < 2 && (
              <View style={{ gap: 10 }}>
                {photoUploading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={{ color: colors.mute, marginTop: 8, fontSize: 13 }}>Upload en cours…</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => handlePickPhoto('camera')}
                      style={{
                        backgroundColor: colors.accent, borderRadius: 14,
                        paddingVertical: 14, flexDirection: 'row',
                        alignItems: 'center', justifyContent: 'center', gap: 10,
                      }}
                    >
                      <Ionicons name="camera" size={20} color={colors.accentInk} />
                      <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>Prendre une photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handlePickPhoto('gallery')}
                      style={{
                        backgroundColor: colors.surface2, borderRadius: 14,
                        paddingVertical: 14, flexDirection: 'row',
                        alignItems: 'center', justifyContent: 'center', gap: 10,
                        borderWidth: 1, borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="images-outline" size={20} color={colors.text} />
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Choisir dans la galerie</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Exercise picker modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: `${colors.bg}F5`, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 16, maxHeight: '85%', borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Ajouter un exercice</Text>
              <TouchableOpacity onPress={() => { setPickerOpen(false); setSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.mute} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher (nom ou groupe)…"
                placeholderTextColor={colors.mute}
                autoCorrect={false}
                style={{
                  backgroundColor: colors.surface2, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  padding: 12, color: colors.text, fontSize: 14,
                }}
              />
            </View>

            <FlatList
              data={filteredLibrary}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => addExerciseFromLibrary(item.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>
                      {item.muscleGroup} · {item.defaultSets}×{item.defaultReps}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={26} color={colors.accent} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: colors.mute, textAlign: 'center', padding: 24 }}>
                  Aucun exercice trouvé.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Finishing spinner */}
      {finishing && !result && (
        <View style={{
          position: 'absolute', inset: 0, zIndex: 20,
          backgroundColor: `${colors.bg}F5`,
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.text2, fontSize: 14 }}>Calcul des récompenses…</Text>
        </View>
      )}

      {/* Workout result */}
      {result && (
        <View style={{
          position: 'absolute', inset: 0, zIndex: 30,
          backgroundColor: `${colors.bg}FA`,
          padding: 24, justifyContent: 'center',
        }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
              Séance terminée
            </Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 6, marginBottom: 24 }}>
              Bien joué ! 🔥
            </Text>

            {/* XP */}
            <Card padding={20} style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 44, fontWeight: '800', color: colors.accent }}>
                +{result.xpEarned}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mute, marginTop: 2 }}>XP gagnés</Text>
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{result.totalXp}</Text>
                  <Text style={{ fontSize: 10, color: colors.mute }}>XP total</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>🔥 {result.streakDays}</Text>
                  <Text style={{ fontSize: 10, color: colors.mute }}>Jours streak</Text>
                </View>
              </View>
            </Card>

            {/* New PRs */}
            {result.newPRs.length > 0 && (
              <Card padding={16} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warn, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  🥇 {result.newPRs.length} nouveau{result.newPRs.length > 1 ? 'x' : ''} record{result.newPRs.length > 1 ? 's' : ''}
                </Text>
                {result.newPRs.map((pr, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: colors.text }}>{pr.exerciseName}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>
                      {pr.weight}kg × {pr.reps}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* New achievements */}
            {result.newAchievements.length > 0 && (
              <Card padding={16} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  🏆 Succès débloqué{result.newAchievements.length > 1 ? 's' : ''}
                </Text>
                {result.newAchievements.map((a, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 26 }}>{a.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{a.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.mute, textTransform: 'capitalize' }}>{a.rarity}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>+{a.xpReward}</Text>
                  </View>
                ))}
              </Card>
            )}

            <TouchableOpacity
              onPress={dismissResult}
              style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>Continuer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Composant : timer de repos visuel ─────────────────────────────────────────
const REST_MESSAGES = [
  'Récupère bien 💪',
  'Prépare-toi mentalement',
  'Reste concentré(e) 🧠',
  'Tu assures ! 🔥',
  'Presque prêt(e) !',
];

function RestTimerOverlay({
  remaining, total, colors, onSkip, onAdd30,
}: {
  remaining: number; total: number; colors: any;
  onSkip: () => void; onAdd30: () => void;
}) {
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 88;
  const STROKE = 10;
  const circumference = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, remaining / Math.max(total, 1)));
  const dashOffset = circumference * (1 - progress);

  const ringColor = remaining <= 5
    ? colors.danger
    : remaining <= 15
    ? colors.warn
    : colors.accent;

  const msgIdx = Math.floor((1 - progress) * (REST_MESSAGES.length - 0.01));

  return (
    <View style={{
      position: 'absolute', inset: 0, zIndex: 10,
      backgroundColor: `${colors.bg}F2`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: colors.mute,
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24,
      }}>
        Temps de repos
      </Text>

      {/* Cercle SVG */}
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Fond */}
          <SvgCircle cx={CX} cy={CY} r={R} fill="none" stroke={colors.surface3} strokeWidth={STROKE} />
          {/* Arc progression */}
          <SvgCircle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        </Svg>
        {/* Chiffre centré sur le cercle */}
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{
            fontSize: 62, fontWeight: '800',
            color: ringColor, fontFamily: 'monospace', lineHeight: 68,
          }}>
            {remaining}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mute }}>secondes</Text>
        </View>
      </View>

      {/* Message motivant */}
      <Text style={{ fontSize: 15, color: colors.text2, marginTop: 20, fontStyle: 'italic' }}>
        {REST_MESSAGES[Math.min(msgIdx, REST_MESSAGES.length - 1)]}
      </Text>

      {/* Boutons */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 32 }}>
        <TouchableOpacity
          onPress={onAdd30}
          style={{
            backgroundColor: colors.surface2, borderRadius: 14,
            paddingHorizontal: 22, paddingVertical: 13,
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 15 }}>+30s</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          style={{
            backgroundColor: ringColor, borderRadius: 14,
            paddingHorizontal: 30, paddingVertical: 13,
          }}
        >
          <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
            Passer ⚡
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
