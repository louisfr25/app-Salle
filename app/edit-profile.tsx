/**
 * Édition du profil — nom, username, bio, date de naissance,
 * genre, objectif, niveau, mensurations + photo de profil.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../lib/store/useAppStore';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/database.types';

// ── Constantes de sélection ───────────────────────────────────────────
const GENDER_OPTIONS = [
  { id: 'male',   label: 'Homme' },
  { id: 'female', label: 'Femme' },
  { id: 'other',  label: 'Autre' },
] as const;

const GOAL_OPTIONS = [
  { id: 'muscle',      emoji: '💪', label: 'Masse' },
  { id: 'strength',    emoji: '🏋️', label: 'Force' },
  { id: 'weight_loss', emoji: '🔥', label: 'Sèche' },
  { id: 'endurance',   emoji: '🏃', label: 'Cardio' },
  { id: 'general',     emoji: '⚡', label: 'Forme' },
] as const;

const LEVEL_OPTIONS = [
  { id: 'beginner',     label: 'Débutant' },
  { id: 'intermediate', label: 'Intermédiaire' },
  { id: 'advanced',     label: 'Avancé' },
] as const;

type Gender = typeof GENDER_OPTIONS[number]['id'];
type Goal   = typeof GOAL_OPTIONS[number]['id'];
type Level  = typeof LEVEL_OPTIONS[number]['id'];

// ── Helpers ───────────────────────────────────────────────────────────
const clampNum = (v: number | null, min: number, max: number) =>
  v == null || Number.isNaN(v) ? null : Math.min(max, Math.max(min, v));

/** DD/MM/YYYY → YYYY-MM-DD, ou null si invalide */
function dmyToIso(dmy: string): string | null {
  const trimmed = dmy.trim();
  if (trimmed.length !== 10) return null;
  const [d, m, y] = trimmed.split('/');
  if (!d || !m || !y) return null;
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD → DD/MM/YYYY */
function isoToDmy(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Composant champ texte stable (évite démontage clavier) ────────────
interface FieldProps {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
}

const Field = React.memo(function Field({
  label, placeholder, defaultValue, onChangeText,
  keyboardType = 'default', autoCapitalize = 'sentences',
  maxLength, multiline = false, hint,
}: FieldProps) {
  const colors = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        defaultValue={defaultValue}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mute}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          color: colors.text,
          fontSize: 15,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint && (
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
});

// ── Composant sélecteur en ligne ──────────────────────────────────────
interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly { id: T; label: string; emoji?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}

function ChipGroup<T extends string>({ label, options, value, onChange }: ChipGroupProps<T>) {
  const colors = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: active ? colors.accent : colors.surface,
                borderWidth: 1.5,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              {opt.emoji && <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>}
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? colors.accentInk : colors.text }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────
export default function EditProfileScreen() {
  const colors = useTheme();
  const { profile, setProfile } = useAppStore();

  // ── État du formulaire ────────────────────────────────────────────
  const fullNameRef    = useRef(profile?.full_name ?? '');
  const usernameRef    = useRef(profile?.username ?? '');
  const bioRef         = useRef(profile?.bio ?? '');
  const birthDateRef   = useRef(isoToDmy(profile?.birth_date ?? null));
  const heightRef      = useRef(profile?.height_cm ? String(profile.height_cm) : '');
  const weightRef      = useRef(profile?.weight_kg ? String(profile.weight_kg) : '');

  const [gender, setGender]         = useState<Gender | null>((profile?.gender as Gender) ?? null);
  const [goal, setGoal]             = useState<Goal | null>((profile?.goal as Goal) ?? null);
  const [level, setLevel]           = useState<Level>((profile?.level as Level) ?? 'beginner');
  const [avatarUri, setAvatarUri]   = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null); // URI locale avant upload
  const [saving, setSaving]         = useState(false);

  // Clé pour forcer le remontage des champs si on ré-ouvre l'écran après une sauvegarde
  const [formKey, setFormKey] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    fullNameRef.current  = profile.full_name ?? '';
    usernameRef.current  = profile.username ?? '';
    bioRef.current       = profile.bio ?? '';
    birthDateRef.current = isoToDmy(profile.birth_date ?? null);
    heightRef.current    = profile.height_cm ? String(profile.height_cm) : '';
    weightRef.current    = profile.weight_kg ? String(profile.weight_kg) : '';
    setGender((profile.gender as Gender) ?? null);
    setGoal((profile.goal as Goal) ?? null);
    setLevel((profile.level as Level) ?? 'beginner');
    setAvatarUri(profile.avatar_url ?? null);
    setFormKey((k) => k + 1);
  }, [profile?.id]));

  // ── Sélection / upload avatar ─────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Active l\'accès à ta galerie dans les paramètres de l\'app.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarLocal(result.assets[0].uri);
    }
  };

  const uploadAvatarIfNeeded = async (userId: string): Promise<string | null> => {
    if (!avatarLocal) return avatarUri; // pas de changement
    try {
      const response = await fetch(avatarLocal);
      const blob = await response.blob();
      const ext = avatarLocal.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust via timestamp
      return `${publicUrl}?t=${Date.now()}`;
    } catch (err) {
      if (__DEV__) console.warn('avatar upload', err);
      return avatarUri; // Retomber sur l'ancienne URL sans bloquer la sauvegarde
    }
  };

  // ── Validation ────────────────────────────────────────────────────
  const validate = (): string | null => {
    const uname = usernameRef.current.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (uname.length < 3) return 'Le username doit faire au moins 3 caractères.';
    if (uname.length > 20) return 'Le username ne peut pas dépasser 20 caractères.';

    const bd = birthDateRef.current.trim();
    if (bd.length > 0 && !dmyToIso(bd)) return 'Date de naissance invalide (format DD/MM/AAAA).';

    const h = heightRef.current.trim();
    if (h && (isNaN(parseFloat(h)) || parseFloat(h) < 80 || parseFloat(h) > 260))
      return 'Taille invalide (80–260 cm).';

    const w = weightRef.current.trim();
    if (w && (isNaN(parseFloat(w)) || parseFloat(w) < 25 || parseFloat(w) > 400))
      return 'Poids invalide (25–400 kg).';

    return null;
  };

  // ── Sauvegarde ────────────────────────────────────────────────────
  const save = async () => {
    const err = validate();
    if (err) { Alert.alert('Données invalides', err); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Non connecté');

      const newAvatarUrl = await uploadAvatarIfNeeded(user.id);

      const update = {
        full_name:  fullNameRef.current.trim().slice(0, 60) || null,
        username:   usernameRef.current.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
        bio:        bioRef.current.trim().slice(0, 200) || null,
        birth_date: dmyToIso(birthDateRef.current),
        gender:     gender ?? null,
        goal:       goal ?? null,
        level,
        height_cm:  clampNum(heightRef.current ? parseFloat(heightRef.current) : null, 80, 260),
        weight_kg:  clampNum(weightRef.current ? parseFloat(weightRef.current) : null, 25, 400),
        avatar_url: newAvatarUrl,
      };

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le poids du jour si renseigné
      if (update.weight_kg) {
        await supabase.from('daily_logs').upsert(
          { user_id: user.id, date: new Date().toISOString().split('T')[0], body_weight_kg: update.weight_kg },
          { onConflict: 'user_id,date' }
        );
      }

      if (updated) setProfile(updated as Profile);
      setAvatarLocal(null);

      Alert.alert('✅ Profil mis à jour', '', [{ text: 'OK', onPress: () => router.canGoBack() ? router.back() : router.replace('/(tabs)') }]);
    } catch (e: any) {
      if (__DEV__) console.error('edit-profile save', e);
      // Détection doublon username (contrainte unique Supabase → code 23505)
      if (e?.code === '23505' || e?.message?.includes('username')) {
        Alert.alert('Username déjà pris', 'Choisis un autre nom d\'utilisateur.');
      } else {
        Alert.alert('Erreur', 'La sauvegarde a échoué. Réessaie.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────
  const displayAvatar = avatarLocal ?? avatarUri;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Modifier le profil</Text>
          <TouchableOpacity onPress={save} disabled={saving} style={{ opacity: saving ? 0.5 : 1 }}>
            {saving
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>Sauvegarder</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 4 }}
        >
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
              {displayAvatar ? (
                <Image
                  source={{ uri: displayAvatar }}
                  style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: colors.accent }}
                />
              ) : (
                <View style={{
                  width: 90, height: 90, borderRadius: 45,
                  backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 36, fontWeight: '800', color: colors.accentInk }}>
                    {(usernameRef.current[0] ?? profile?.username?.[0] ?? 'A').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: colors.bg,
              }}>
                <Ionicons name="camera" size={14} color={colors.accentInk} />
              </View>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: colors.mute, marginTop: 8 }}>
              Appuie pour changer la photo
            </Text>
          </View>

          {/* Section — Identité */}
          <SectionTitle title="IDENTITÉ" colors={colors} />

          <Field
            key={`fn-${formKey}`}
            label="Prénom / Nom"
            placeholder="ex : Jean Dupont"
            defaultValue={profile?.full_name ?? ''}
            onChangeText={(v) => { fullNameRef.current = v; }}
            autoCapitalize="words"
            maxLength={60}
          />

          <Field
            key={`un-${formKey}`}
            label="Username *"
            placeholder="ex : jean_fit"
            defaultValue={profile?.username ?? ''}
            onChangeText={(v) => { usernameRef.current = v; }}
            autoCapitalize="none"
            maxLength={20}
            hint="3–20 caractères, lettres minuscules, chiffres et _"
          />

          <Field
            key={`bio-${formKey}`}
            label="Bio"
            placeholder="Quelques mots sur toi…"
            defaultValue={profile?.bio ?? ''}
            onChangeText={(v) => { bioRef.current = v; }}
            multiline
            maxLength={200}
          />

          <Field
            key={`bd-${formKey}`}
            label="Date de naissance"
            placeholder="DD/MM/AAAA"
            defaultValue={isoToDmy(profile?.birth_date ?? null)}
            onChangeText={(v) => { birthDateRef.current = v; }}
            keyboardType="numeric"
            maxLength={10}
          />

          <ChipGroup
            label="Genre"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
          />

          {/* Section — Mensurations */}
          <SectionTitle title="MENSURATIONS" colors={colors} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                key={`h-${formKey}`}
                label="Taille (cm)"
                placeholder="175"
                defaultValue={profile?.height_cm ? String(profile.height_cm) : ''}
                onChangeText={(v) => { heightRef.current = v; }}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                key={`w-${formKey}`}
                label="Poids (kg)"
                placeholder="75"
                defaultValue={profile?.weight_kg ? String(profile.weight_kg) : ''}
                onChangeText={(v) => { weightRef.current = v; }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Section — Fitness */}
          <SectionTitle title="FITNESS" colors={colors} />

          <ChipGroup
            label="Objectif"
            options={GOAL_OPTIONS}
            value={goal}
            onChange={setGoal}
          />

          <ChipGroup
            label="Niveau"
            options={LEVEL_OPTIONS}
            value={level}
            onChange={setLevel}
          />

          {/* Bouton sauvegarde bas de page */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 16,
              padding: 17,
              alignItems: 'center',
              marginTop: 12,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? <ActivityIndicator color={colors.accentInk} />
              : <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>Sauvegarder le profil</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Titre de section ───────────────────────────────────────────────────
function SectionTitle({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: '700', color: colors.mute,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginBottom: 12, marginTop: 8,
    }}>
      {title}
    </Text>
  );
}
