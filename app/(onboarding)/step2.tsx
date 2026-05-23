/**
 * Étape 2 — Objectif principal
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useOnboardingStore } from '../../lib/store/useOnboardingStore';
import { ProgressBar } from '../../components/ui/ProgressBar';

const GOALS = [
  { id: 'muscle',      emoji: '💪', title: 'Masse musculaire',  desc: 'Prendre du volume, gagner en force' },
  { id: 'strength',    emoji: '🏋️', title: 'Force pure',         desc: 'Améliorer tes 1RM sur les grands mouvements' },
  { id: 'weight_loss', emoji: '🔥', title: 'Perte de poids',     desc: 'Brûler des graisses, rester tonique' },
  { id: 'endurance',   emoji: '⚡', title: 'Endurance',          desc: 'Cardio, résistance, explosivité' },
  { id: 'general',     emoji: '🎯', title: 'Forme générale',     desc: 'Rester en bonne santé, progresser à mon rythme' },
];

export default function Step2() {
  const colors = useTheme();
  const { data, set } = useOnboardingStore();

  const next = () => {
    if (!data.goal) { Alert.alert('Choix requis', 'Sélectionne un objectif.'); return; }
    router.push('/(onboarding)/step3');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <ProgressBar value={2 / 4} style={{ marginBottom: 32 }} />

        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6 }}>
          Ton objectif 🎯
        </Text>
        <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32, lineHeight: 22 }}>
          On adapte ton programme et ton suivi à ce qui compte vraiment pour toi.
        </Text>

        <View style={{ gap: 12 }}>
          {GOALS.map((g) => {
            const active = data.goal === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => set({ goal: g.id as any })}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 16,
                  padding: 18, borderRadius: 18,
                  backgroundColor: active ? `${colors.accent}18` : colors.surface,
                  borderWidth: 2,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: active ? colors.accent : colors.text }}>
                    {g.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{g.desc}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2, borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <Text style={{ color: colors.accentInk, fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 40 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flex: 1, padding: 17, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>← Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={next}
            style={{ flex: 2, backgroundColor: colors.accent, borderRadius: 16, padding: 17, alignItems: 'center' }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>Continuer →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
