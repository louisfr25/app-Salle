import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../lib/store/useAppStore';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import type { DailyLog, Profile } from '../lib/database.types';

// ── Calcul TDEE personnalisé (Mifflin-St Jeor) ───────────────────────────────
function calcTDEE(p: Profile | null): {
  kcal: number; protein: number; carbs: number; fat: number; complete: boolean;
} {
  const DEFAULT = { kcal: 2400, protein: 180, carbs: 250, fat: 70, complete: false };
  if (!p || !p.weight_kg || !p.height_cm) return DEFAULT;

  const w = p.weight_kg;
  const h = p.height_cm;
  let age = 25;
  if (p.birth_date) {
    age = new Date().getFullYear() - new Date(p.birth_date).getFullYear();
  }

  // BMR Mifflin-St Jeor
  const bmr = p.gender === 'female'
    ? 10 * w + 6.25 * h - 5 * age - 161
    : 10 * w + 6.25 * h - 5 * age + 5;

  // Facteur d'activité selon niveau
  const actFactor =
    p.level === 'advanced'     ? 1.725 :
    p.level === 'intermediate' ? 1.55  : 1.375;

  let tdee = Math.round(bmr * actFactor);

  // Ajustement selon objectif
  if (p.goal === 'muscle' || p.goal === 'strength') tdee += 300;
  else if (p.goal === 'weight_loss')                tdee -= 400;

  // Macros : protéines en priorité, lipides à 25%, glucides pour compléter
  const protein = Math.round(w * (p.goal === 'weight_loss' ? 2.5 : 2.0));
  const fat      = Math.round((tdee * 0.25) / 9);
  const carbs    = Math.max(50, Math.round((tdee - protein * 4 - fat * 9) / 4));

  return { kcal: tdee, protein, carbs, fat, complete: true };
}

type Colors = ReturnType<typeof useTheme>;

// ── Stable Field component (declared OUTSIDE the screen so it is not
//    recreated on every keystroke — that was dismissing the keyboard) ──
const Field = React.memo(function Field({
  icon, label, value, onChange, unit, decimal = false, colors, badge,
}: {
  icon: string;
  label: string;
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
  unit: string;
  decimal?: boolean;
  colors: Colors;
  badge?: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    }}>
      <Text style={{ fontSize: 20, width: 36 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
        {badge && (
          <Text style={{ fontSize: 10, color: colors.accent, marginTop: 1 }}>{badge}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          defaultValue={value != null ? String(value) : ''}
          onChangeText={(t) => {
            // Normalise la virgule (séparateur décimal Android) en point
          const n = decimal ? parseFloat(t.replace(',', '.')) : parseInt(t, 10);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={colors.mute}
          style={{
            minWidth: 72, textAlign: 'center',
            fontSize: 16, fontWeight: '700', color: colors.accent,
            backgroundColor: colors.surface2, borderRadius: 10,
            paddingHorizontal: 10, paddingVertical: 7,
            borderWidth: 1, borderColor: colors.border,
          }}
        />
        <Text style={{ fontSize: 12, color: colors.mute, width: 32 }}>{unit}</Text>
      </View>
    </View>
  );
});

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function DailyScreen() {
  const colors  = useTheme();
  const profile = useAppStore((s) => s.profile);
  const tdee    = useMemo(() => calcTDEE(profile), [
    profile?.weight_kg, profile?.height_cm, profile?.birth_date,
    profile?.gender, profile?.goal, profile?.level,
  ]);
  const [date, setDate] = useState(todayStr());
  const [log, setLog] = useState<Partial<DailyLog>>({ date: todayStr() });
  const [saved, setSaved] = useState(false);
  const [stepsFromHealth, setStepsFromHealth] = useState<number | null>(null);
  // Bump this key to force inputs to remount when the day changes / data loads
  const [formKey, setFormKey] = useState(0);

  const loadForDate = useCallback(async (d: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', d)
      .maybeSingle();
    // Fresh empty form for a new day, or the saved values if they exist
    setLog(data ?? { date: d });
    setFormKey((k) => k + 1);
  }, []);

  // Reload every time the screen is focused, recomputing "today" so the
  // form is empty on a new day (and editable if already filled today).
  useFocusEffect(
    useCallback(() => {
      const d = todayStr();
      setDate(d);
      loadForDate(d);
      loadHealthSteps();
    }, [loadForDate]),
  );

  const loadHealthSteps = async () => {
    try {
      // @ts-expect-error — expo-sensors optionnel (présent en Expo Go iOS)
      const { Pedometer } = await import('expo-sensors');
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) return;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const result = await Pedometer.getStepCountAsync(start, end);
      if (result?.steps) {
        setStepsFromHealth(result.steps);
        setLog((l) => ({ ...l, steps: l.steps ?? result.steps }));
      }
    } catch {
      /* mode manuel */
    }
  };

  const save = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    await supabase
      .from('daily_logs')
      .upsert(
        { ...log, user_id: user.id, date },
        { onConflict: 'user_id,date' },
      );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: keyof DailyLog) => (v: number | undefined) =>
    setLog((l) => ({ ...l, [key]: v }));

  const macros = [
    { key: 'protein_g' as keyof DailyLog, label: 'Protéines', goal: tdee.protein, color: '#5C7CFF' },
    { key: 'carbs_g' as keyof DailyLog,   label: 'Glucides',  goal: tdee.carbs,   color: colors.warn },
    { key: 'fat_g' as keyof DailyLog,     label: 'Lipides',   goal: tdee.fat,     color: colors.danger },
  ];
  const totalKcal = log.calories ?? 0;
  const kcalGoal  = tdee.kcal;

  const isToday = date === todayStr();
  const prettyDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Suivi quotidien</Text>
            <Text style={{ fontSize: 12, color: colors.mute }}>
              {prettyDate}{isToday ? " · aujourd'hui" : ''}
            </Text>
          </View>
          {stepsFromHealth != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.accent}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="fitness-outline" size={14} color={colors.accent} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>Santé</Text>
            </View>
          )}
        </View>

        {/* Calories ring */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Card padding={16}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                borderWidth: 8, borderColor: colors.surface2,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <View style={{
                  position: 'absolute', inset: 0, borderRadius: 50,
                  borderWidth: 8, borderColor: colors.accent,
                  opacity: Math.min(1, (totalKcal / kcalGoal) * 0.9 + 0.1),
                }} />
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.accent }}>{totalKcal}</Text>
                <Text style={{ fontSize: 10, color: colors.mute }}>kcal</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.mute, marginTop: 8 }}>
                Objectif : {kcalGoal} kcal
                {tdee.complete ? ' · TDEE personnalisé' : ' · par défaut'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {macros.map((m) => {
                const val = (log[m.key] as number) ?? 0;
                const pct = Math.min(100, (val / m.goal) * 100);
                return (
                  <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: m.color }}>{val}g</Text>
                    <View style={{ width: '100%', height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: m.color, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 10, color: colors.mute }}>{m.label}</Text>
                    <Text style={{ fontSize: 9, color: colors.mute }}>{m.goal}g obj.</Text>
                  </View>
                );
              })}
            </View>

            {/* Invite à compléter le profil si TDEE non calculable */}
            {!tdee.complete && (
              <TouchableOpacity
                onPress={() => router.push('/edit-profile' as any)}
                style={{
                  marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: `${colors.accent}12`, borderRadius: 10,
                  padding: 10, borderWidth: 1, borderColor: `${colors.accent}30`,
                }}
              >
                <Ionicons name="person-outline" size={14} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 12, color: colors.accent }}>
                  Renseigne ton poids et ta taille pour personnaliser tes objectifs
                </Text>
                <Ionicons name="chevron-forward" size={12} color={colors.accent} />
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* Corps */}
        <View key={`corps-${formKey}`} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Corps
          </Text>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <Field icon="⚖️" label="Poids corporel" value={log.body_weight_kg} onChange={set('body_weight_kg')} unit="kg" decimal colors={colors} />
            <View style={{ borderBottomWidth: 0 }}>
              <Field icon="💧" label="Eau consommée" value={log.water_ml} onChange={set('water_ml')} unit="ml" colors={colors} />
            </View>
          </Card>
        </View>

        {/* Nutrition */}
        <View key={`nutri-${formKey}`} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Nutrition
          </Text>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <Field icon="🔥" label="Calories" value={log.calories} onChange={set('calories')} unit="kcal" colors={colors} />
            <Field icon="🥩" label="Protéines" value={log.protein_g} onChange={set('protein_g')} unit="g" decimal colors={colors} />
            <Field icon="🍞" label="Glucides" value={log.carbs_g} onChange={set('carbs_g')} unit="g" decimal colors={colors} />
            <View style={{ borderBottomWidth: 0 }}>
              <Field icon="🧈" label="Lipides" value={log.fat_g} onChange={set('fat_g')} unit="g" decimal colors={colors} />
            </View>
          </Card>
        </View>

        {/* Activité */}
        <View key={`act-${formKey}`} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Activité
          </Text>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <Field
              icon="👟" label="Pas" value={log.steps} onChange={set('steps')} unit="pas" colors={colors}
              badge={stepsFromHealth != null ? '↑ Santé iPhone' : undefined}
            />
            <View style={{ borderBottomWidth: 0 }}>
              <Field icon="🏃" label="Cardio" value={log.cardio_minutes} onChange={set('cardio_minutes')} unit="min" colors={colors} />
            </View>
          </Card>
        </View>

        {/* Sauvegarder */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={save}
            style={{
              backgroundColor: saved ? colors.success : colors.accent,
              borderRadius: 16, padding: 17, alignItems: 'center',
            }}
          >
            <Text style={{ color: saved ? '#fff' : colors.accentInk, fontWeight: '800', fontSize: 16 }}>
              {saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: colors.mute, textAlign: 'center', marginTop: 10 }}>
            Reviens chaque jour : un nouveau formulaire t'attend pour suivre ta progression.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
