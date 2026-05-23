/**
 * Étape 1 — Identité : prénom, nom d'utilisateur, date de naissance, genre
 */
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useOnboardingStore } from '../../lib/store/useOnboardingStore';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function Step1() {
  const colors = useTheme();
  const { data, set } = useOnboardingStore();

  const next = () => {
    if (!data.full_name.trim()) {
      Alert.alert('Champ requis', 'Entre ton prénom.');
      return;
    }
    if (!data.username.trim()) {
      Alert.alert('Champ requis', 'Choisis un nom d\'utilisateur.');
      return;
    }
    router.push('/(onboarding)/step2');
  };

  const genders = [
    { id: 'male', label: '♂ Homme' },
    { id: 'female', label: '♀ Femme' },
    { id: 'other', label: '⊕ Autre' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Progress */}
          <ProgressBar value={1 / 4} style={{ marginBottom: 32 }} />

          {/* Header */}
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6 }}>
            Qui es-tu ? 👋
          </Text>
          <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32, lineHeight: 22 }}>
            Ces infos nous permettent de personnaliser ton expérience.
          </Text>

          {/* Prénom */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Prénom
          </Text>
          <TextInput
            value={data.full_name}
            onChangeText={(t) => set({ full_name: t })}
            placeholder="ex: Thomas"
            placeholderTextColor={colors.mute}
            autoCapitalize="words"
            style={input(colors)}
          />

          {/* Username */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 }}>
            Nom d'utilisateur
          </Text>
          <TextInput
            value={data.username}
            onChangeText={(t) => set({ username: t.toLowerCase().replace(/\s/g, '') })}
            placeholder="ex: thom_lifts"
            placeholderTextColor={colors.mute}
            autoCapitalize="none"
            autoCorrect={false}
            style={input(colors)}
          />

          {/* Date de naissance */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 }}>
            Date de naissance (optionnel)
          </Text>
          <TextInput
            value={data.birth_date}
            onChangeText={(t) => set({ birth_date: t })}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor={colors.mute}
            keyboardType="numeric"
            style={input(colors)}
          />

          {/* Genre */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 20 }}>
            Genre (optionnel)
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {genders.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => set({ gender: g.id as any })}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: data.gender === g.id ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: data.gender === g.id ? colors.accent : colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: data.gender === g.id ? colors.accentInk : colors.text }}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={next}
            style={{ marginTop: 40, backgroundColor: colors.accent, borderRadius: 16, padding: 17, alignItems: 'center' }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>Continuer →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const input = (colors: any) => ({
  backgroundColor: colors.surface,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
  color: colors.text,
  fontSize: 16,
  marginBottom: 4,
});
