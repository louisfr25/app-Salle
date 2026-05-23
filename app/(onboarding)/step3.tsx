/**
 * Étape 3 — Niveau + mensurations
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useOnboardingStore } from '../../lib/store/useOnboardingStore';
import { ProgressBar } from '../../components/ui/ProgressBar';

const LEVELS = [
  { id: 'beginner',     emoji: '🌱', title: 'Débutant',     desc: 'Moins d\'1 an de pratique régulière' },
  { id: 'intermediate', emoji: '💪', title: 'Intermédiaire', desc: '1 à 3 ans, bases solides' },
  { id: 'advanced',     emoji: '🏆', title: 'Avancé',        desc: '3 ans+ avec progression mesurée' },
];

export default function Step3() {
  const colors = useTheme();
  const { data, set } = useOnboardingStore();

  const next = () => {
    if (!data.level) { Alert.alert('Choix requis', 'Sélectionne ton niveau.'); return; }
    router.push('/(onboarding)/step4');
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    flex: 1,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <ProgressBar value={3 / 4} style={{ marginBottom: 32 }} />

          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6 }}>
            Ton niveau 📊
          </Text>
          <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32, lineHeight: 22 }}>
            Sois honnête — on calibre l'intensité pour toi.
          </Text>

          {/* Niveau */}
          <View style={{ gap: 10, marginBottom: 32 }}>
            {LEVELS.map((l) => {
              const active = data.level === l.id;
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => set({ level: l.id as any })}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    padding: 16, borderRadius: 16,
                    backgroundColor: active ? `${colors.accent}18` : colors.surface,
                    borderWidth: 2,
                    borderColor: active ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{l.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: active ? colors.accent : colors.text }}>{l.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.mute, marginTop: 1 }}>{l.desc}</Text>
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

          {/* Mensurations */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Mensurations (optionnel)
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.mute, marginBottom: 6 }}>Taille</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={data.height_cm}
                  onChangeText={(t) => set({ height_cm: t })}
                  placeholder="175"
                  placeholderTextColor={colors.mute}
                  keyboardType="numeric"
                  style={inputStyle}
                />
                <Text style={{ color: colors.mute, fontSize: 13 }}>cm</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.mute, marginBottom: 6 }}>Poids</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={data.weight_kg}
                  onChangeText={(t) => set({ weight_kg: t })}
                  placeholder="75"
                  placeholderTextColor={colors.mute}
                  keyboardType="decimal-pad"
                  style={inputStyle}
                />
                <Text style={{ color: colors.mute, fontSize: 13 }}>kg</Text>
              </View>
            </View>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
