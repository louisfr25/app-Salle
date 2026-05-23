/**
 * Étape 4 — Fréquence + mode de programme → sauvegarde tout en BDD
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useOnboardingStore } from '../../lib/store/useOnboardingStore';
import { useAppStore } from '../../lib/store/useAppStore';
import { supabase } from '../../lib/supabase';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Profile } from '../../lib/database.types';

const DAYS = [2, 3, 4, 5, 6];

export default function Step4() {
  const colors = useTheme();
  const { data, set, reset } = useOnboardingStore();
  const setProfile = useAppStore((s) => s.setProfile);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      // getSession() lit le token local — plus fiable juste après signup
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      // Parse birth_date DD/MM/YYYY → YYYY-MM-DD
      let birthIso: string | null = null;
      if (data.birth_date.length === 10) {
        const [d, m, y] = data.birth_date.split('/');
        if (d && m && y) birthIso = `${y}-${m}-${d}`;
      }

      // Validation / bornage des entrées (anti-données aberrantes & abus)
      const clampNum = (v: number | null, min: number, max: number) =>
        v == null || Number.isNaN(v) ? null : Math.min(max, Math.max(min, v));

      // 1. Mettre à jour le profil
      const profileUpdate = {
        full_name:  data.full_name.trim().slice(0, 60),
        username:   data.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
        birth_date: birthIso,
        gender:     data.gender || null,
        goal:       data.goal || null,
        level:      data.level || 'beginner',
        height_cm:  clampNum(data.height_cm ? parseFloat(data.height_cm) : null, 80, 260),
        weight_kg:  clampNum(data.weight_kg ? parseFloat(data.weight_kg) : null, 25, 400),
      };

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. Mettre à jour le store global
      if (updatedProfile) setProfile(updatedProfile as Profile);

      // 3. Enregistrer le poids initial dans daily_logs si renseigné
      if (data.weight_kg) {
        await supabase.from('daily_logs').upsert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          body_weight_kg: parseFloat(data.weight_kg),
        });
      }

      reset();

      // 4. Redirection selon le mode de programme choisi
      if (data.program_source === 'ai') {
        router.replace('/program/generate');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (__DEV__) console.error('onboarding finish', e);
      Alert.alert('Erreur', 'Une erreur est survenue. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <ProgressBar value={1} style={{ marginBottom: 32 }} />

        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6 }}>
          Ton programme 📋
        </Text>
        <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32, lineHeight: 22 }}>
          Combien de fois par semaine peux-tu t'entraîner ?
        </Text>

        {/* Fréquence */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Séances par semaine
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          {DAYS.map((d) => {
            const active = data.days_per_week === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => set({ days_per_week: d })}
                style={{
                  width: 60, height: 60, borderRadius: 16,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 2,
                  borderColor: active ? colors.accent : colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '800', color: active ? colors.accentInk : colors.text }}>{d}</Text>
                <Text style={{ fontSize: 9, color: active ? colors.accentInk : colors.mute, marginTop: 1 }}>j/sem</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mode de programme */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Création du programme
        </Text>
        <View style={{ gap: 12, marginBottom: 40 }}>
          {[
            { id: 'ai', emoji: '✨', title: 'Généré par l\'IA', desc: `Salle crée un programme ${data.days_per_week}j/sem adapté à ton objectif` },
            { id: 'manual', emoji: '✏️', title: 'Je le crée moi-même', desc: 'Tu choisis tes séances et exercices à la main' },
          ].map((opt) => {
            const active = data.program_source === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => set({ program_source: opt.id as any })}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  padding: 18, borderRadius: 18,
                  backgroundColor: active ? `${colors.accent}18` : colors.surface,
                  borderWidth: 2,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                <Text style={{ fontSize: 28 }}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: active ? colors.accent : colors.text }}>{opt.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{opt.desc}</Text>
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

        {/* Récap */}
        <View style={{
          backgroundColor: colors.surface, borderRadius: 16,
          borderWidth: 1, borderColor: colors.border,
          padding: 16, gap: 8, marginBottom: 24,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Récapitulatif
          </Text>
          {[
            { label: 'Prénom',   val: data.full_name || '—' },
            { label: 'Username', val: `@${data.username}` || '—' },
            { label: 'Objectif', val: data.goal === 'muscle' ? 'Masse musculaire' : data.goal === 'strength' ? 'Force' : data.goal === 'weight_loss' ? 'Perte de poids' : data.goal === 'endurance' ? 'Endurance' : 'Forme générale' },
            { label: 'Niveau',   val: data.level === 'beginner' ? 'Débutant' : data.level === 'intermediate' ? 'Intermédiaire' : 'Avancé' },
            { label: 'Fréquence', val: `${data.days_per_week} séances/sem` },
          ].map(({ label, val }) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: colors.mute }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{val}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flex: 1, padding: 17, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>← Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={finish}
            disabled={saving}
            style={{ flex: 2, backgroundColor: colors.accent, borderRadius: 16, padding: 17, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
          >
            {saving
              ? <ActivityIndicator color={colors.accentInk} />
              : <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>C'est parti ! 🚀</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
