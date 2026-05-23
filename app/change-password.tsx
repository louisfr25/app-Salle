/**
 * Changement de mot de passe — depuis les Paramètres.
 * Vérifie l'ancien MDP via re-auth, puis applique le nouveau.
 * Lien "Mot de passe oublié ?" → envoi d'un email Supabase.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

// ── Force du mot de passe ─────────────────────────────────────────────
type Strength = 'none' | 'weak' | 'medium' | 'strong';

function passwordStrength(pwd: string): Strength {
  if (pwd.length === 0) return 'none';
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

const STRENGTH_CONFIG: Record<Strength, { label: string; color: string; bars: number }> = {
  none:   { label: '',        color: 'transparent', bars: 0 },
  weak:   { label: 'Faible', color: '#FF5468',      bars: 1 },
  medium: { label: 'Moyen',  color: '#FFB13D',      bars: 2 },
  strong: { label: 'Fort',   color: '#4ADE80',      bars: 3 },
};

// ── Champ mot de passe avec affichage/masquage ────────────────────────
function PwdField({
  label, placeholder, onChangeText, showStrength = false,
}: {
  label: string;
  placeholder?: string;
  onChangeText: (v: string) => void;
  showStrength?: boolean;
}) {
  const colors = useTheme();
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');

  const handleChange = (v: string) => {
    setValue(v);
    onChangeText(v);
  };

  const strength = showStrength ? passwordStrength(value) : 'none';
  const cfg = STRENGTH_CONFIG[strength];

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 12,
        paddingRight: 12,
      }}>
        <TextInput
          secureTextEntry={!show}
          placeholder={placeholder ?? '••••••••'}
          placeholderTextColor={colors.mute}
          onChangeText={handleChange}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, padding: 14, color: colors.text, fontSize: 15 }}
        />
        <TouchableOpacity onPress={() => setShow((s) => !s)} hitSlop={8}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mute} />
        </TouchableOpacity>
      </View>

      {/* Indicateur de force */}
      {showStrength && value.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
            {[1, 2, 3].map((bar) => (
              <View
                key={bar}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  backgroundColor: cfg.bars >= bar ? cfg.color : colors.surface3,
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color, width: 42, textAlign: 'right' }}>
            {cfg.label}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────
export default function ChangePasswordScreen() {
  const colors = useTheme();

  const currentRef  = useRef('');
  const newRef      = useRef('');
  const confirmRef  = useRef('');
  const [saving, setSaving]       = useState(false);
  const [resetMode, setResetMode] = useState(false); // mode "mot de passe oublié"
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent]   = useState(false);

  // ── Validation ────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!currentRef.current) return 'Saisis ton mot de passe actuel.';
    if (newRef.current.length < 8) return 'Le nouveau mot de passe doit faire au moins 8 caractères.';
    if (newRef.current !== confirmRef.current) return 'Les deux mots de passe ne correspondent pas.';
    if (newRef.current === currentRef.current) return 'Le nouveau mot de passe doit être différent de l\'actuel.';
    return null;
  };

  // ── Changement de MDP ─────────────────────────────────────────────
  const handleChange = async () => {
    const err = validate();
    if (err) { Alert.alert('Données invalides', err); return; }

    setSaving(true);
    try {
      // 1. Récupérer l'email de l'utilisateur courant
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) throw new Error('Non connecté');

      // 2. Re-authentification pour vérifier l'ancien MDP
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentRef.current,
      });
      if (signInError) {
        Alert.alert('Mot de passe incorrect', 'Ton mot de passe actuel est erroné.');
        return;
      }

      // 3. Mise à jour du mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newRef.current,
      });
      if (updateError) throw updateError;

      Alert.alert(
        '✅ Mot de passe modifié',
        'Ton mot de passe a été mis à jour avec succès.',
        [{ text: 'OK', onPress: () => router.canGoBack() ? router.back() : router.replace('/settings' as any) }]
      );
    } catch (e: any) {
      if (__DEV__) console.error('change-password', e);
      Alert.alert('Erreur', 'La modification a échoué. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  // ── Mot de passe oublié ───────────────────────────────────────────
  const handleReset = async () => {
    if (!resetEmail.includes('@')) {
      Alert.alert('Email invalide', 'Entre une adresse email valide.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: 'salle://change-password', // deep link vers l'app après clic email
      });
      if (error) throw error;
      setResetSent(true);
    } catch (e: any) {
      if (__DEV__) console.error('reset-password', e);
      Alert.alert('Erreur', 'L\'envoi a échoué. Vérifie ta connexion et réessaie.');
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/settings' as any)}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
            {resetMode ? 'Réinitialiser le mot de passe' : 'Changer le mot de passe'}
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        >
          {/* ── Mode normal : changement ──────────────────────────── */}
          {!resetMode && (
            <>
              {/* Icône décorative */}
              <View style={{ alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: `${colors.accent}18`,
                  borderWidth: 1, borderColor: `${colors.accent}30`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="lock-closed" size={32} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 13, color: colors.mute, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
                  Choisis un mot de passe fort{'\n'}d'au moins 8 caractères.
                </Text>
              </View>

              <PwdField
                label="Mot de passe actuel"
                placeholder="Ton mot de passe actuel"
                onChangeText={(v) => { currentRef.current = v; }}
              />

              <PwdField
                label="Nouveau mot de passe"
                placeholder="Au moins 8 caractères"
                onChangeText={(v) => { newRef.current = v; }}
                showStrength
              />

              <PwdField
                label="Confirmer le nouveau"
                placeholder="Répète le nouveau mot de passe"
                onChangeText={(v) => { confirmRef.current = v; }}
              />

              {/* Conseils sécurité */}
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                marginBottom: 24,
                gap: 8,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Conseils
                </Text>
                {[
                  '8 caractères minimum',
                  'Mélange majuscules, chiffres et symboles',
                  'N\'utilise pas le même que sur d\'autres sites',
                ].map((tip) => (
                  <View key={tip} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                    <Text style={{ fontSize: 13, color: colors.text2, flex: 1 }}>{tip}</Text>
                  </View>
                ))}
              </View>

              {/* Bouton principal */}
              <TouchableOpacity
                onPress={handleChange}
                disabled={saving}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 16,
                  padding: 17,
                  alignItems: 'center',
                  opacity: saving ? 0.7 : 1,
                  marginBottom: 16,
                }}
              >
                {saving
                  ? <ActivityIndicator color={colors.accentInk} />
                  : <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>
                      Mettre à jour
                    </Text>
                }
              </TouchableOpacity>

              {/* Lien oublié */}
              <TouchableOpacity
                onPress={() => setResetMode(true)}
                style={{ alignItems: 'center', padding: 8 }}
              >
                <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '600' }}>
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Mode réinitialisation par email ───────────────────── */}
          {resetMode && !resetSent && (
            <>
              <View style={{ alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: `${colors.accent}18`,
                  borderWidth: 1, borderColor: `${colors.accent}30`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="mail" size={32} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 13, color: colors.mute, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
                  Entre ton adresse email.{'\n'}Tu recevras un lien de réinitialisation.
                </Text>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Adresse email
                </Text>
                <TextInput
                  placeholder="ton@email.com"
                  placeholderTextColor={colors.mute}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 12, padding: 14,
                    color: colors.text, fontSize: 15,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleReset}
                disabled={saving}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 16, padding: 17,
                  alignItems: 'center',
                  opacity: saving ? 0.7 : 1,
                  marginBottom: 16,
                }}
              >
                {saving
                  ? <ActivityIndicator color={colors.accentInk} />
                  : <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>
                      Envoyer le lien
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setResetMode(false)}
                style={{ alignItems: 'center', padding: 8 }}
              >
                <Text style={{ fontSize: 14, color: colors.mute }}>← Retour</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Email envoyé ──────────────────────────────────────── */}
          {resetMode && resetSent && (
            <View style={{ alignItems: 'center', paddingTop: 32, gap: 16 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: `${colors.success}18`,
                borderWidth: 1, borderColor: `${colors.success}30`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 36 }}>📩</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                Email envoyé !
              </Text>
              <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                Vérifie ta boîte mail — et les spams. Clique sur le lien pour choisir un nouveau mot de passe.
              </Text>
              <TouchableOpacity
                onPress={() => { setResetMode(false); setResetSent(false); }}
                style={{
                  marginTop: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingHorizontal: 24, paddingVertical: 12,
                  borderWidth: 1, borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>← Retour à la connexion</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
