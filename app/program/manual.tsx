/**
 * Créateur de programme manuel — sans IA.
 * Étapes : nom + objectif + nb jours → génère N séances vides
 * puis redirige vers l'éditeur programme existant.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

// ── Options ───────────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'muscle',      emoji: '💪', label: 'Prise de masse' },
  { id: 'strength',    emoji: '🏋️', label: 'Force' },
  { id: 'weight_loss', emoji: '🔥', label: 'Sèche / Cardio' },
  { id: 'endurance',   emoji: '🏃', label: 'Endurance' },
  { id: 'general',     emoji: '⚡', label: 'Forme générale' },
] as const;

type Goal = typeof GOALS[number]['id'];

const SESSION_NAMES: Record<number, string[]> = {
  2: ['Haut du corps', 'Bas du corps'],
  3: ['Push', 'Pull', 'Jambes'],
  4: ['Pectoraux & Triceps', 'Dos & Biceps', 'Jambes', 'Épaules & Abdos'],
  5: ['Push A', 'Pull A', 'Jambes', 'Push B', 'Pull B'],
  6: ['Push A', 'Pull A', 'Jambes A', 'Push B', 'Pull B', 'Jambes B'],
};

// ── Composant ─────────────────────────────────────────────────────────────────
export default function ManualProgramScreen() {
  const colors  = useTheme();
  const profile = useAppStore((s) => s.profile);

  const [name,    setName]    = useState('');
  const [goal,    setGoal]    = useState<Goal>('general');
  const [days,    setDays]    = useState(3);
  const [saving,  setSaving]  = useState(false);

  // ── Création ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Donne un nom à ton programme.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      // Désactiver les anciens programmes
      await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);

      // Créer le programme
      const { data: prog, error: progErr } = await supabase
        .from('programs')
        .insert({
          user_id:       user.id,
          name:          name.trim(),
          goal,
          level:         profile?.level ?? 'beginner',
          days_per_week: days,
          source:        'manual',
          is_active:     true,
        })
        .select()
        .single();

      if (progErr || !prog) throw progErr ?? new Error('Création échouée');

      // Créer les séances vides (noms auto selon nb jours)
      const sessionNames = SESSION_NAMES[days] ??
        Array.from({ length: days }, (_, i) => `Séance ${String.fromCharCode(65 + i)}`);

      const sessionRows = sessionNames.map((sName, i) => ({
        program_id:   prog.id,
        name:         sName,
        day_index:    i,
        duration_min: 60,
        notes:        null,
      }));

      await supabase.from('program_sessions').insert(sessionRows);

      Alert.alert(
        '✅ Programme créé !',
        `"${name.trim()}" — ${days} jours/semaine.\nAjoute maintenant tes exercices dans chaque séance.`,
        [{ text: 'Personnaliser', onPress: () => router.replace('/program' as any) }],
      );
    } catch (e: any) {
      if (__DEV__) console.error('[manual program]', e);
      Alert.alert('Erreur', 'Impossible de créer le programme. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/program' as any)}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>
            Créer un programme
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 60 }}
        >
          {/* Nom du programme */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Nom du programme
            </Text>
            <TextInput
              placeholder="ex : PPL Printemps, Mon programme perso…"
              placeholderTextColor={colors.mute}
              value={name}
              onChangeText={setName}
              maxLength={50}
              style={{
                backgroundColor: colors.surface, borderRadius: 14,
                borderWidth: 1, borderColor: colors.border,
                padding: 14, color: colors.text, fontSize: 15,
              }}
            />
          </View>

          {/* Objectif */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Objectif principal
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setGoal(g.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1.5,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? colors.accentInk : colors.text }}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Jours par semaine */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Jours d'entraînement par semaine
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[2, 3, 4, 5, 6].map((d) => {
                const active = days === d;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDays(d)}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1.5,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '800', color: active ? colors.accentInk : colors.text }}>
                      {d}
                    </Text>
                    <Text style={{ fontSize: 9, color: active ? colors.accentInk : colors.mute, marginTop: 2 }}>
                      {d === 2 ? 'jours' : d === 3 ? 'jours' : d <= 5 ? 'jours' : 'jours'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Aperçu des séances générées */}
          <Card padding={14}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Séances générées automatiquement
            </Text>
            {(SESSION_NAMES[days] ?? Array.from({ length: days }, (_, i) => `Séance ${String.fromCharCode(65 + i)}`))
              .map((sName, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 8,
                    backgroundColor: `${colors.accent}20`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>{sName}</Text>
                  <Text style={{ marginLeft: 'auto', fontSize: 11, color: colors.mute }}>Vide</Text>
                </View>
              ))
            }
            <Text style={{ fontSize: 11, color: colors.mute, marginTop: 8 }}>
              Tu pourras ajouter des exercices dans chaque séance depuis l'éditeur.
            </Text>
          </Card>

          {/* Bouton créer */}
          <Button
            label={saving ? 'Création…' : 'Créer le programme'}
            onPress={handleCreate}
            loading={saving}
            size="lg"
            style={{ marginTop: 4 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
