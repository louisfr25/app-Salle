/**
 * Onboarding multi-étapes — premier lancement
 * 0 → Bienvenue + prénom
 * 1 → Objectif
 * 2 → Niveau
 * 3 → Infos physiques
 * 4 → Programme créé + "C'est parti !"
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../lib/store/useAppStore';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/database.types';

// ── Données ───────────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'muscle',      emoji: '💪', label: 'Prise de masse',   desc: 'Développe tes muscles' },
  { id: 'strength',    emoji: '🏋️', label: 'Force',            desc: 'Soulève plus lourd' },
  { id: 'weight_loss', emoji: '🔥', label: 'Sèche / Cardio',   desc: 'Brûle les graisses' },
  { id: 'endurance',   emoji: '🏃', label: 'Endurance',        desc: 'Cours plus longtemps' },
  { id: 'general',     emoji: '⚡', label: 'Forme générale',   desc: 'Reste en bonne santé' },
] as const;

const LEVELS = [
  { id: 'beginner',     emoji: '🌱', label: 'Débutant',     desc: 'Moins de 1 an de sport' },
  { id: 'intermediate', emoji: '⚡', label: 'Intermédiaire', desc: '1 à 3 ans de pratique' },
  { id: 'advanced',     emoji: '🔥', label: 'Avancé',       desc: 'Plus de 3 ans de sport' },
] as const;

const DAYS_OPTIONS = [2, 3, 4, 5, 6];
const SESSION_NAMES: Record<number, string[]> = {
  2: ['Haut du corps', 'Bas du corps'],
  3: ['Push', 'Pull', 'Jambes'],
  4: ['Pectoraux & Triceps', 'Dos & Biceps', 'Jambes', 'Épaules & Abdos'],
  5: ['Push A', 'Pull A', 'Jambes', 'Push B', 'Pull B'],
  6: ['Push A', 'Pull A', 'Jambes A', 'Push B', 'Pull B', 'Jambes B'],
};

type Goal  = typeof GOALS[number]['id'];
type Level = typeof LEVELS[number]['id'];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const colors   = useTheme();
  const setProfile = useAppStore((s) => s.setProfile);

  const [step,       setStep]       = useState(0);
  const [username,   setUsername]   = useState('');
  const [goal,       setGoal]       = useState<Goal>('general');
  const [level,      setLevel]      = useState<Level>('beginner');
  const [weightKg,   setWeightKg]   = useState('');
  const [heightCm,   setHeightCm]   = useState('');
  const [daysPerWk,  setDaysPerWk]  = useState(3);
  const [saving,     setSaving]     = useState(false);
  const [programName, setProgramName] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionTo = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const canProceed = () => {
    if (step === 0) return username.trim().length >= 2;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      // Mise à jour du profil
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({
          username:   username.trim(),
          full_name:  username.trim(),
          goal,
          level,
          weight_kg:  weightKg ? parseFloat(weightKg) : null,
          height_cm:  heightCm ? parseFloat(heightCm) : null,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updatedProfile) {
        setProfile(updatedProfile as Profile);
      }

      // Création du programme de départ
      const progName = `Mon programme ${GOALS.find((g) => g.id === goal)?.label ?? ''}`;
      setProgramName(progName);

      await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);

      const { data: prog } = await supabase
        .from('programs')
        .insert({
          user_id:       user.id,
          name:          progName,
          goal,
          level,
          days_per_week: daysPerWk,
          source:        'manual',
          is_active:     true,
        })
        .select()
        .single();

      if (prog) {
        const sessionNames = SESSION_NAMES[daysPerWk]
          ?? Array.from({ length: daysPerWk }, (_, i) => `Séance ${String.fromCharCode(65 + i)}`);
        await supabase.from('program_sessions').insert(
          sessionNames.map((n, i) => ({
            program_id:   prog.id,
            name:         n,
            day_index:    i,
            duration_min: 60,
            notes:        null,
          }))
        );
      }

      transitionTo(4);
    } catch (e) {
      if (__DEV__) console.error('[onboarding]', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu par étape ───────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── Étape 0 : Bienvenue + prénom ──────────────────────────────────────
      case 0:
        return (
          <View style={{ gap: 28 }}>
            <View>
              <Text style={{ fontSize: 36, fontWeight: '900', color: colors.accent, letterSpacing: -1 }}>
                Bienvenue 👋
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>
                sur Salle.
              </Text>
              <Text style={{ fontSize: 15, color: colors.mute, marginTop: 10, lineHeight: 22 }}>
                L'app qui transforme chaque séance en progression mesurable. On commence ?
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Ton prénom ou pseudo
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="ex : Alex, MuscleKing, FitBoss…"
                placeholderTextColor={colors.mute}
                maxLength={30}
                autoFocus
                style={{
                  backgroundColor: colors.surface, borderRadius: 14,
                  borderWidth: 1.5, borderColor: username.length >= 2 ? colors.accent : colors.border,
                  padding: 16, color: colors.text, fontSize: 18, fontWeight: '700',
                }}
              />
            </View>
          </View>
        );

      // ── Étape 1 : Objectif ────────────────────────────────────────────────
      case 1:
        return (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>
                Quel est ton{'\n'}objectif principal ?
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setGoal(g.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 16, borderRadius: 16,
                      backgroundColor: active ? `${colors.accent}20` : colors.surface,
                      borderWidth: 2,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: active ? colors.accent : colors.text }}>
                        {g.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{g.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // ── Étape 2 : Niveau ──────────────────────────────────────────────────
      case 2:
        return (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>
                Ton niveau{'\n'}actuel ?
              </Text>
              <Text style={{ fontSize: 14, color: colors.mute, marginTop: 8 }}>
                Sois honnête — ça permet d'adapter les charges et le programme.
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {LEVELS.map((l) => {
                const active = level === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => setLevel(l.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 18, borderRadius: 16,
                      backgroundColor: active ? `${colors.accent}20` : colors.surface,
                      borderWidth: 2, borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{l.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: active ? colors.accent : colors.text }}>
                        {l.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{l.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // ── Étape 3 : Infos physiques + jours ────────────────────────────────
      case 3:
        return (
          <View style={{ gap: 24 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>
                Quelques infos{'\n'}physiques
              </Text>
              <Text style={{ fontSize: 14, color: colors.mute, marginTop: 8 }}>
                Optionnel — pour personnaliser tes objectifs nutritionnels (TDEE).
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Poids (kg)</Text>
                <TextInput
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                  placeholder="75"
                  placeholderTextColor={colors.mute}
                  style={{
                    backgroundColor: colors.surface, borderRadius: 12,
                    borderWidth: 1, borderColor: colors.border,
                    padding: 14, color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Taille (cm)</Text>
                <TextInput
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="175"
                  placeholderTextColor={colors.mute}
                  style={{
                    backgroundColor: colors.surface, borderRadius: 12,
                    borderWidth: 1, borderColor: colors.border,
                    padding: 14, color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center',
                  }}
                />
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Jours d'entraînement / semaine
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DAYS_OPTIONS.map((d) => {
                  const active = daysPerWk === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDaysPerWk(d)}
                      style={{
                        flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
                        backgroundColor: active ? colors.accent : colors.surface,
                        borderWidth: 2, borderColor: active ? colors.accent : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 20, fontWeight: '900', color: active ? colors.accentInk : colors.text }}>
                        {d}
                      </Text>
                      <Text style={{ fontSize: 9, color: active ? colors.accentInk : colors.mute, marginTop: 2 }}>
                        jours
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        );

      // ── Étape 4 : Terminé ─────────────────────────────────────────────────
      case 4:
        return (
          <View style={{ gap: 24, alignItems: 'center', paddingTop: 20 }}>
            <LinearGradient
              colors={[`${colors.accent}30`, `${colors.accent}05`]}
              style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 56 }}>🎉</Text>
            </LinearGradient>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 30, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
                C'est parti,{'\n'}{username} !
              </Text>
              <Text style={{ fontSize: 15, color: colors.mute, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 }}>
                Ton programme{'\n'}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>{programName}</Text>
                {'\n'}est prêt. Personnalise-le dans "Mon programme".
              </Text>
            </View>

            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              {[
                { emoji: '📈', label: 'Suis chaque séance et chaque série' },
                { emoji: '🏆', label: 'Bats tes records et monte dans le classement' },
                { emoji: '🍎', label: 'Synchronise avec l\'app Santé' },
              ].map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: colors.surface, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: colors.border,
                }}>
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500', flex: 1 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Progress dots */}
        {step < TOTAL_STEPS && (
          <View style={{ flexDirection: 'row', gap: 6, padding: 20, paddingBottom: 0 }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={{
                  height: 4, flex: i < step ? 0 : 1,
                  width: i < step ? 20 : undefined,
                  borderRadius: 2,
                  backgroundColor: i <= step ? colors.accent : colors.surface2,
                  minWidth: 20,
                }}
              />
            ))}
          </View>
        )}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        {/* Navigation */}
        <View style={{ padding: 20, gap: 12 }}>
          {step < TOTAL_STEPS - 1 ? (
            // Steps 0–2: Suivant
            <TouchableOpacity
              onPress={() => {
                if (!canProceed()) return;
                if (step === 3) {
                  handleFinish();
                } else {
                  transitionTo(step + 1);
                }
              }}
              disabled={!canProceed() || saving}
              style={{
                backgroundColor: canProceed() ? colors.accent : colors.surface2,
                borderRadius: 16, padding: 18, alignItems: 'center',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '800', color: canProceed() ? colors.accentInk : colors.mute }}>
                  {step === 3 ? "Créer mon programme 🚀" : "Suivant →"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            // Step 4: Terminé
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)')}
              style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 18, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accentInk }}>
                Démarrer 🎉
              </Text>
            </TouchableOpacity>
          )}

          {step > 0 && step < TOTAL_STEPS && (
            <TouchableOpacity onPress={() => transitionTo(step - 1)} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 14, color: colors.mute }}>← Retour</Text>
            </TouchableOpacity>
          )}

          {step === 0 && (
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ fontSize: 13, color: colors.mute }}>Passer pour l'instant</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
