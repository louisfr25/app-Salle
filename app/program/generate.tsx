import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { generateProgramWithGroq } from '../../lib/groq';
import { EXERCISE_LIBRARY } from '../../constants/exercises';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type ProgramSource = 'ai' | 'manual';

// Convertit un ID string (ex: "bench_press") en UUID Supabase
const exIdToUUID = (exId: string): string => {
  const idx = EXERCISE_LIBRARY.findIndex((e) => e.id === exId);
  if (idx === -1) return '';
  return `00000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
};

const LOADING_STEPS = [
  'Analyse de ton profil...',
  'Construction des séances...',
  'Optimisation des exercices...',
  'Calibrage des charges et repos...',
  'Finalisation du programme...',
];

export default function GenerateProgramScreen() {
  const colors = useTheme();
  const profile = useAppStore((s) => s.profile);
  const [source, setSource] = useState<ProgramSource | null>(null);

  // AI fields — pré-remplis depuis le profil
  const [goal, setGoal] = useState(profile?.goal ?? 'muscle');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Manual fields
  const [programName, setProgramName] = useState('');
  const [sessions, setSessions] = useState<
    { name: string; exercises: { id: string; sets: number; reps: number }[] }[]
  >([{ name: 'Séance A', exercises: [] }]);
  const [saving, setSaving] = useState(false);

  // Animation spinner
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (generating) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [generating]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Cycle des messages de chargement
  useEffect(() => {
    if (!generating) return;
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [generating]);

  /* ── Génération IA ── */
  const generateAI = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      // Appel Groq — Llama 3.3 70B
      const aiProgram = await generateProgramWithGroq({
        goal,
        level: profile?.level ?? 'beginner',
        daysPerWeek,
        gender: profile?.gender,
        availableExerciseIds: EXERCISE_LIBRARY.map((e) => e.id),
      });

      // Désactiver les anciens programmes
      await supabase
        .from('programs')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Créer le programme en BDD
      const { data: prog } = await supabase
        .from('programs')
        .insert({
          user_id: user.id,
          name: aiProgram.name,
          goal,
          days_per_week: daysPerWeek,
          source: 'ai',
          is_active: true,
        })
        .select()
        .single();

      if (!prog) throw new Error('Erreur création programme');

      // Insérer les séances et exercices
      for (let i = 0; i < aiProgram.sessions.length; i++) {
        const s = aiProgram.sessions[i];
        const { data: sess } = await supabase
          .from('program_sessions')
          .insert({
            program_id: prog.id,
            name: s.name,
            day_index: i,
            duration_min: 60,
          })
          .select()
          .single();

        if (sess && s.exercises.length > 0) {
          const rows = s.exercises
            .map((ex, j) => {
              const uuid = exIdToUUID(ex.exercise_id);
              if (!uuid) return null;
              return {
                session_id: sess.id,
                exercise_id: uuid,
                order_index: j,
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.rest_seconds,
              };
            })
            .filter(Boolean);

          if (rows.length > 0) {
            await supabase.from('session_exercises').insert(rows as any);
          }
        }
      }

      router.replace('/program');
    } catch (e: any) {
      if (__DEV__) console.error('generateAI', e);
      Alert.alert('Erreur IA', 'La génération a échoué. Réessaie dans un instant.');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Création manuelle ── */
  const saveManual = async () => {
    if (!programName.trim()) {
      Alert.alert('Nom requis', 'Donne un nom à ton programme');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);

      const { data: prog } = await supabase
        .from('programs')
        .insert({
          user_id: user.id,
          name: programName,
          days_per_week: sessions.length,
          source: 'manual',
          is_active: true,
        })
        .select()
        .single();

      if (prog) {
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const { data: sess } = await supabase
            .from('program_sessions')
            .insert({ program_id: prog.id, name: s.name, day_index: i, duration_min: 60 })
            .select()
            .single();

          if (sess && s.exercises.length > 0) {
            await supabase.from('session_exercises').insert(
              s.exercises.map((e, j) => ({
                session_id: sess.id,
                exercise_id: e.id,
                order_index: j,
                sets: e.sets,
                reps: e.reps,
                rest_seconds: 90,
              }))
            );
          }
        }
      }
      router.replace('/program');
    } catch (e: any) {
      if (__DEV__) console.error('manual program', e);
      Alert.alert('Erreur', 'Une erreur est survenue. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const addSession = () => {
    setSessions((s) => [...s, { name: `Séance ${String.fromCharCode(65 + s.length)}`, exercises: [] }]);
  };

  const addExercise = (sessionIdx: number, exId: string) => {
    const lib = EXERCISE_LIBRARY.find((e) => e.id === exId);
    if (!lib) return;
    const dbId = exIdToUUID(exId);
    setSessions((s) => {
      const updated = [...s];
      updated[sessionIdx] = {
        ...updated[sessionIdx],
        exercises: [...updated[sessionIdx].exercises, { id: dbId, sets: lib.defaultSets, reps: lib.defaultReps }],
      };
      return updated;
    });
  };

  /* ── Écran de chargement IA ── */
  if (generating) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 32 }}>
          {/* Spinner */}
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              borderWidth: 3, borderColor: colors.accent,
              borderTopColor: 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 32 }}>✨</Text>
            </View>
          </Animated.View>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
              L'IA génère ton programme
            </Text>
            <Text style={{ fontSize: 15, color: colors.accent, fontWeight: '600' }}>
              {LOADING_STEPS[loadingStep]}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>
              Llama 3.3 70B analyse ton profil{'\n'}et construit un programme sur-mesure.
            </Text>
          </View>

          {/* Barre de progression */}
          <View style={{ width: '100%', height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              backgroundColor: colors.accent,
              borderRadius: 2,
            }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Sélection de source ── */
  if (!source) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            style={{ marginBottom: 8 }}
          >
            <Text style={{ color: colors.accent }}>← Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
            Créer un programme
          </Text>
          <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 8 }}>
            Comment veux-tu créer ton programme ?
          </Text>

          {[
            { id: 'ai', icon: '✨', title: 'Généré par IA', badge: 'Groq · Llama 3.3 70B', desc: 'L\'IA analyse ton profil et construit un programme optimal sur-mesure' },
            { id: 'manual', icon: '✏️', title: 'Manuel', badge: null, desc: 'Tu choisis toi-même tes séances et exercices' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setSource(opt.id as ProgramSource)}
              style={{
                backgroundColor: colors.surface, borderRadius: 18,
                borderWidth: 1, borderColor: opt.id === 'ai' ? `${colors.accent}60` : colors.border,
                padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
              }}
            >
              <Text style={{ fontSize: 32 }}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{opt.title}</Text>
                  {opt.badge && (
                    <View style={{ backgroundColor: `${colors.accent}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>{opt.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: colors.mute }}>{opt.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mute} />
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  /* ── Mode IA ── */
  if (source === 'ai') {
    const GOALS = [
      { id: 'muscle', label: '💪 Masse' },
      { id: 'strength', label: '🏋️ Force' },
      { id: 'weight_loss', label: '🔥 Sèche' },
      { id: 'endurance', label: '⚡ Endurance' },
      { id: 'general', label: '🎯 Général' },
    ];
    const DAYS = [2, 3, 4, 5, 6];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setSource(null)}>
            <Text style={{ color: colors.accent }}>← Retour</Text>
          </TouchableOpacity>

          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
              Génération IA ✨
            </Text>
            <Text style={{ fontSize: 14, color: colors.mute, marginTop: 4 }}>
              Propulsé par Llama 3.3 70B via Groq
            </Text>
          </View>

          {/* Objectif */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Objectif principal
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOALS.map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setGoal(id as typeof goal)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: goal === id ? colors.accent : colors.surface,
                    borderWidth: 1, borderColor: goal === id ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{ color: goal === id ? colors.accentInk : colors.text, fontWeight: '600', fontSize: 13 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Fréquence */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Séances par semaine
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDaysPerWeek(d)}
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    backgroundColor: daysPerWeek === d ? colors.accent : colors.surface,
                    borderWidth: 2, borderColor: daysPerWeek === d ? colors.accent : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '800', color: daysPerWeek === d ? colors.accentInk : colors.text }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Profil détecté */}
          {profile && (
            <View style={{
              backgroundColor: `${colors.accent}10`, borderRadius: 14,
              borderWidth: 1, borderColor: `${colors.accent}30`, padding: 14,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, marginBottom: 8 }}>
                PROFIL DÉTECTÉ — utilisé par l'IA
              </Text>
              {[
                ['Niveau', profile.level === 'beginner' ? 'Débutant' : profile.level === 'intermediate' ? 'Intermédiaire' : 'Avancé'],
                ['Genre', profile.gender === 'male' ? 'Homme' : profile.gender === 'female' ? 'Femme' : 'Non précisé'],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: colors.mute }}>{k}</Text>
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{v}</Text>
                </View>
              ))}
            </View>
          )}

          <Button
            label="Générer mon programme ✨"
            onPress={generateAI}
            size="lg"
            style={{ marginTop: 4 }}
          />

          {/* Lien alternatif — programme manuel */}
          <TouchableOpacity
            onPress={() => router.replace('/program/manual' as any)}
            style={{ alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 13, color: colors.mute }}>
              Préfères-tu{' '}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>créer ton programme manuellement ?</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Mode manuel ── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <TouchableOpacity onPress={() => setSource(null)}>
          <Text style={{ color: colors.accent }}>← Retour</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Programme manuel ✏️</Text>

        <TextInput
          placeholder="Nom du programme"
          placeholderTextColor={colors.mute}
          value={programName}
          onChangeText={setProgramName}
          style={{
            backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
            padding: 16, color: colors.text, fontSize: 16, fontWeight: '700',
          }}
        />

        {sessions.map((sess, si) => (
          <Card key={si} padding={16}>
            <TextInput
              value={sess.name}
              onChangeText={(t) => {
                const updated = [...sessions];
                updated[si] = { ...updated[si], name: t };
                setSessions(updated);
              }}
              style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}
            />
            {sess.exercises.length > 0 && (
              <View style={{ gap: 6, marginBottom: 12 }}>
                {sess.exercises.map((ex, ei) => {
                  const lib = EXERCISE_LIBRARY.find(
                    (e) => exIdToUUID(e.id) === ex.id
                  );
                  return (
                    <View key={ei} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{lib?.name ?? ex.id}</Text>
                      <Text style={{ fontSize: 12, color: colors.mute }}>{ex.sets}×{ex.reps}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EXERCISE_LIBRARY.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => addExercise(si, ex.id)}
                    style={{
                      backgroundColor: colors.surface2 ?? colors.surface, borderRadius: 10,
                      borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.text }}>{ex.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Card>
        ))}

        <Button label="+ Ajouter une séance" onPress={addSession} variant="ghost" />
        <Button label="Enregistrer le programme" onPress={saveManual} loading={saving} size="lg" />
      </ScrollView>
    </SafeAreaView>
  );
}
