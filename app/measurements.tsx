/**
 * Mesures corporelles — historique + ajout
 * Table Supabase : body_measurements (voir migration_body_measurements.sql)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BodyMeasurement {
  id: string;
  user_id: string;
  measured_at: string;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  neck_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
}

type MeasurementKey = keyof Omit<BodyMeasurement, 'id' | 'user_id' | 'measured_at' | 'notes'>;

const FIELDS: Array<{ key: MeasurementKey; label: string; emoji: string; unit: string }> = [
  { key: 'chest_cm',      label: 'Poitrine',    emoji: '🫁', unit: 'cm' },
  { key: 'waist_cm',      label: 'Taille',      emoji: '⚡', unit: 'cm' },
  { key: 'hips_cm',       label: 'Hanches',     emoji: '🍑', unit: 'cm' },
  { key: 'left_arm_cm',   label: 'Bras G.',     emoji: '💪', unit: 'cm' },
  { key: 'right_arm_cm',  label: 'Bras D.',     emoji: '💪', unit: 'cm' },
  { key: 'left_thigh_cm', label: 'Cuisse G.',   emoji: '🦵', unit: 'cm' },
  { key: 'right_thigh_cm',label: 'Cuisse D.',   emoji: '🦵', unit: 'cm' },
  { key: 'neck_cm',        label: 'Cou',         emoji: '🦒', unit: 'cm' },
  { key: 'body_fat_pct',  label: '% Graisse',   emoji: '📊', unit: '%' },
];

// ── Mini graphique SVG ────────────────────────────────────────────────────────
function MiniChart({
  data, color, width = 260, height = 80,
}: {
  data: { date: string; value: number }[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 10;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const pts = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * chartW,
    y: pad + chartH - ((d.value - min) / range) * chartH,
  }));

  const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
    </Svg>
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function MeasurementsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [tableError, setTableError]     = useState(false);

  // Formulaire d'ajout
  const [form, setForm] = useState<Partial<Record<MeasurementKey, string>>>({});
  const [formNotes, setFormNotes] = useState('');
  const [selectedChart, setSelectedChart] = useState<MeasurementKey>('chest_cm');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: true });

      if (error) {
        if (error.code === '42P01') { // table does not exist
          setTableError(true);
        }
        return;
      }
      setMeasurements((data as BodyMeasurement[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const row: Record<string, any> = {
        user_id:     user.id,
        measured_at: todayStr(),
        notes:       formNotes || null,
      };
      FIELDS.forEach(({ key }) => {
        const v = form[key];
        row[key] = v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;
      });

      const { error } = await supabase
        .from('body_measurements')
        .upsert(row, { onConflict: 'user_id,measured_at' });

      if (error) throw error;

      setModalOpen(false);
      setForm({});
      setFormNotes('');
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de sauvegarder. Réessaie.');
      if (__DEV__) console.error('[measurements save]', e);
    } finally {
      setSaving(false);
    }
  };

  // Ouvre le formulaire pré-rempli avec les dernières valeurs connues
  const openForm = () => {
    const last = measurements[measurements.length - 1];
    if (last) {
      const prefill: Partial<Record<MeasurementKey, string>> = {};
      FIELDS.forEach(({ key }) => {
        const v = last[key];
        if (v != null) prefill[key] = String(v);
      });
      setForm(prefill);
    }
    setFormNotes('');
    setModalOpen(true);
  };

  // Données pour le graphique sélectionné
  const chartData = measurements
    .filter((m) => m[selectedChart] != null)
    .map((m) => ({ date: m.measured_at, value: m[selectedChart] as number }));

  // Dernière mesure
  const latest = measurements[measurements.length - 1] ?? null;
  const previous = measurements[measurements.length - 2] ?? null;

  const delta = (key: MeasurementKey): string | null => {
    if (!latest?.[key] || !previous?.[key]) return null;
    const diff = (latest[key] as number) - (previous[key] as number);
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>
          📏 Mensurations
        </Text>
        <TouchableOpacity
          onPress={openForm}
          style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentInk }}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {tableError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
            Migration requise
          </Text>
          <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
            Exécute le fichier{'\n'}
            <Text style={{ color: colors.accent, fontFamily: 'monospace' }}>
              supabase/migrations/migration_body_measurements.sql
            </Text>
            {'\n'}dans ton dashboard Supabase pour activer cette fonctionnalité.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 80 }}>

          {measurements.length === 0 ? (
            /* ── État vide ─────────────────────────────────────────── */
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 16 }}>
              <Text style={{ fontSize: 48 }}>📏</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Première mensuration
              </Text>
              <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
                Saisis tes premières mesures pour suivre{'\n'}ton évolution dans le temps.
              </Text>
              <TouchableOpacity
                onPress={openForm}
                style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}
              >
                <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 15 }}>
                  Commencer →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── Dernières mesures ──────────────────────────────── */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  Dernières mesures
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {FIELDS.map(({ key, label, emoji, unit }) => {
                    const val = latest?.[key];
                    if (val == null) return null;
                    const d = delta(key);
                    const isUp = d && parseFloat(d) > 0;
                    const isDown = d && parseFloat(d) < 0;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setSelectedChart(key)}
                        style={{
                          width: '47%',
                          backgroundColor: selectedChart === key ? `${colors.accent}20` : colors.surface,
                          borderRadius: 14, padding: 14,
                          borderWidth: 1.5,
                          borderColor: selectedChart === key ? colors.accent : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{emoji}</Text>
                        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4 }}>{label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                            {val}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.mute }}>{unit}</Text>
                          {d && (
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isUp ? colors.danger : isDown ? colors.success : colors.mute }}>
                              {d}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Graphique ──────────────────────────────────────── */}
              {chartData.length >= 2 && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
                    {FIELDS.find((f) => f.key === selectedChart)?.emoji}{' '}
                    Évolution — {FIELDS.find((f) => f.key === selectedChart)?.label}
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <MiniChart data={chartData} color={colors.accent} width={320} height={100} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: colors.mute }}>
                      {new Date(chartData[0].date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.mute }}>
                      {new Date(chartData[chartData.length - 1].date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.mute, marginTop: 8, textAlign: 'center' }}>
                    Touche une carte ci-dessus pour changer la courbe
                  </Text>
                </View>
              )}

              {/* ── Historique ─────────────────────────────────────── */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  Historique
                </Text>
                <View style={{ gap: 8 }}>
                  {[...measurements].reverse().map((m, i) => (
                    <View key={m.id} style={{
                      backgroundColor: colors.surface, borderRadius: 14,
                      padding: 14, borderWidth: 1, borderColor: colors.border,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 8 }}>
                        {new Date(m.measured_at + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {i === 0 ? '  ← Aujourd\'hui' : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {FIELDS.map(({ key, label, unit }) => {
                          const v = m[key];
                          if (v == null) return null;
                          return (
                            <View key={key} style={{ flexDirection: 'row', gap: 4 }}>
                              <Text style={{ fontSize: 12, color: colors.mute }}>{label}:</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{v} {unit}</Text>
                            </View>
                          );
                        })}
                      </View>
                      {m.notes && (
                        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 6, fontStyle: 'italic' }}>
                          {m.notes}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Modal ajout ──────────────────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: `${colors.bg}F0`, justifyContent: 'flex-end' }}>
          <SafeAreaView style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.border }} edges={['bottom']}>
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>📏 Nouvelle mesure</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.mute} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12, paddingBottom: insets.bottom + 20 }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {FIELDS.map(({ key, label, emoji, unit }) => (
                  <View key={key} style={{ width: '47%' }}>
                    <Text style={{ fontSize: 11, color: colors.mute, marginBottom: 4 }}>
                      {emoji} {label} ({unit})
                    </Text>
                    <TextInput
                      value={form[key] ?? ''}
                      onChangeText={(t) => setForm((prev) => ({ ...prev, [key]: t }))}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.mute}
                      style={{
                        backgroundColor: colors.bg, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border,
                        padding: 12, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center',
                      }}
                    />
                  </View>
                ))}
              </View>

              <View>
                <Text style={{ fontSize: 11, color: colors.mute, marginBottom: 4 }}>📝 Notes (optionnel)</Text>
                <TextInput
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Comment tu te sens, contexte de la prise…"
                  placeholderTextColor={colors.mute}
                  multiline
                  style={{
                    backgroundColor: colors.bg, borderRadius: 10,
                    borderWidth: 1, borderColor: colors.border,
                    padding: 12, color: colors.text, fontSize: 14, minHeight: 60,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accentInk }}>Sauvegarder</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
