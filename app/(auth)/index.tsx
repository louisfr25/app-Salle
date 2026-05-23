import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/ui/Button';

// ── Traduction des erreurs Supabase → français ───────────────────────────────
function translateError(message: string): { text: string; suggestLogin?: boolean } {
  const m = message.toLowerCase();
  if (m.includes('user already registered') || m.includes('already been registered'))
    return { text: 'Cette adresse email est déjà utilisée.', suggestLogin: true };
  if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
    return { text: 'Email ou mot de passe incorrect.' };
  if (m.includes('email not confirmed'))
    return { text: 'Confirme ton adresse email avant de te connecter.' };
  if (m.includes('password should be at least'))
    return { text: 'Le mot de passe doit contenir au moins 6 caractères.' };
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_email_send_rate_limit'))
    return { text: 'Trop de tentatives. Attends quelques minutes avant de réessayer.' };
  if (m.includes('unable to validate') || m.includes('invalid email'))
    return { text: 'Adresse email invalide.' };
  if (m.includes('network') || m.includes('fetch'))
    return { text: 'Problème réseau. Vérifie ta connexion.' };
  return { text: 'Une erreur est survenue. Réessaie.' };
}

// ── Validation côté client ───────────────────────────────────────────────────
function validateSignup(email: string, password: string, username: string): string | null {
  if (!username.trim()) return 'Entre un nom d\'utilisateur.';
  if (username.length < 3) return 'Le nom d\'utilisateur doit faire au moins 3 caractères.';
  if (!/^[a-z0-9_]+$/.test(username)) return 'Caractères autorisés : lettres, chiffres, underscore.';
  if (!email.includes('@')) return 'Adresse email invalide.';
  if (password.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
  return null;
}

export default function AuthScreen() {
  const colors = useTheme();
  const [mode, setMode] = useState<'landing' | 'login' | 'signup' | 'reset'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── Inscription ─────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    const validationError = validateSignup(email.trim(), password, username.trim());
    if (validationError) { Alert.alert('Champ invalide', validationError); return; }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();

      // 1. Vérifier disponibilité du pseudo AVANT de créer le compte
      const { data: existing } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        Alert.alert('Pseudo indisponible', `"${cleanUsername}" est déjà utilisé. Choisis un autre nom.`);
        return;
      }

      // 2. Création du compte
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: cleanUsername } },
      });

      if (signUpError) {
        const { text, suggestLogin } = translateError(signUpError.message);
        Alert.alert('Erreur', text, suggestLogin
          ? [{ text: 'Se connecter', onPress: () => { setMode('login'); } }, { text: 'OK' }]
          : undefined
        );
        return;
      }

      // 3. Obtenir une session (si email confirmation activée → auto-login)
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          Alert.alert(
            'Confirme ton email',
            'Un lien de confirmation a été envoyé. Clique dessus puis connecte-toi.',
            [{ text: 'Aller à la connexion', onPress: () => setMode('login') }]
          );
          return;
        }
      }

      // 4. Lancer l'onboarding
      const { useOnboardingStore } = require('../../lib/store/useOnboardingStore');
      useOnboardingStore.getState().set({ username: cleanUsername });
      router.replace('/(onboarding)/step1');

    } finally {
      setLoading(false);
    }
  };

  // ── Connexion ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Remplis ton email et mot de passe.');
      return;
    }
    setLoading(true);
    try {
      // Timeout de 15s — évite le spinner infini si Supabase ou AsyncStorage bloque
      const loginResult = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15_000)
        ),
      ]);

      const { error } = loginResult;

      if (error) {
        const { text } = translateError(error.message);
        Alert.alert('Connexion refusée', text);
        return;
      }

      // Login OK — profil chargé en arrière-plan par _layout.tsx (onAuthStateChange).
      router.replace('/(tabs)');
    } catch (e: any) {
      if (__DEV__) console.error('[handleLogin]', e);
      if (e?.message === 'timeout') {
        Alert.alert(
          'Connexion trop lente',
          'Le serveur met trop de temps à répondre. Vérifie ta connexion et réessaie.',
        );
      } else {
        Alert.alert('Erreur', 'Une erreur inattendue s\'est produite. Réessaie.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Réinitialisation MDP ─────────────────────────────────────────────────
  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Email requis', 'Entre ton adresse email pour recevoir le lien.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', translateError(error.message).text);
    } else {
      setResetSent(true);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    color: colors.text,
    fontSize: 15,
    flex: 1,
  };

  // ── Landing ──────────────────────────────────────────────────────────────
  if (mode === 'landing') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient
          colors={['transparent', `${colors.accent}18`, 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400 }}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.accentInk }}>S</Text>
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 }}>Salle</Text>
          </View>

          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
            Entraîne-toi.{'\n'}Progresse.{'\n'}Domine.
          </Text>
          <Text style={{ fontSize: 16, color: colors.mute, textAlign: 'center', lineHeight: 24, marginBottom: 48 }}>
            Suivi intelligent, programmes IA,{'\n'}analyse musculaire en temps réel.
          </Text>

          <View style={{ width: '100%', gap: 12 }}>
            <Button label="Commencer gratuitement" onPress={() => setMode('signup')} size="lg" style={{ width: '100%' }} />
            <TouchableOpacity onPress={() => setMode('login')} style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: colors.text2, fontSize: 15 }}>
                Déjà un compte ?{' '}
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Connexion</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 32, marginTop: 48 }}>
            {[['100%', 'Gratuit'], ['IA', 'Intégrée'], ['Illimité', 'Séances']].map(([v, l]) => (
              <View key={l} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>{v}</Text>
                <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Reset MDP ────────────────────────────────────────────────────────────
  if (mode === 'reset') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
          <TouchableOpacity onPress={() => { setMode('login'); setResetSent(false); }} style={{ marginBottom: 32 }}>
            <Text style={{ color: colors.accent, fontSize: 15 }}>← Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Mot de passe oublié</Text>
          <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32 }}>
            {resetSent ? 'Email envoyé ! Vérifie ta boîte mail.' : 'Entre ton email pour recevoir un lien de réinitialisation.'}
          </Text>
          {!resetSent && (
            <>
              <TextInput
                placeholder="Email"
                placeholderTextColor={colors.mute}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ ...inputStyle, flex: undefined, marginBottom: 16 }}
              />
              <Button label="Envoyer le lien" onPress={handleReset} loading={loading} size="lg" />
            </>
          )}
          {resetSent && (
            <Button label="Retour à la connexion" onPress={() => { setMode('login'); setResetSent(false); }} size="lg" />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Signup / Login ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => setMode('landing')} style={{ marginBottom: 32 }}>
          <Text style={{ color: colors.accent, fontSize: 15 }}>← Retour</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
          {mode === 'signup' ? 'Créer un compte' : 'Connexion'}
        </Text>
        <Text style={{ fontSize: 15, color: colors.mute, marginBottom: 32 }}>
          {mode === 'signup' ? 'Rejoins la communauté Salle 💪' : 'Content de te revoir !'}
        </Text>

        <View style={{ gap: 14 }}>
          {/* Pseudo (inscription seulement) */}
          {mode === 'signup' && (
            <View>
              <TextInput
                placeholder="Pseudo (ex: thom_lifts)"
                placeholderTextColor={colors.mute}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ ...inputStyle, flex: undefined }}
              />
              <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4, marginLeft: 4 }}>
                Lettres minuscules, chiffres et _ uniquement
              </Text>
            </View>
          )}

          {/* Email */}
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.mute}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ ...inputStyle, flex: undefined }}
          />

          {/* Mot de passe + toggle visibilité */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              placeholder={mode === 'signup' ? 'Mot de passe (6 car. min.)' : 'Mot de passe'}
              placeholderTextColor={colors.mute}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={inputStyle}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mute} />
            </TouchableOpacity>
          </View>
        </View>

        <Button
          label={mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
          onPress={mode === 'signup' ? handleSignUp : handleLogin}
          loading={loading}
          size="lg"
          style={{ marginTop: 24 }}
        />

        {/* Mot de passe oublié (login seulement) */}
        {mode === 'login' && (
          <TouchableOpacity onPress={() => setMode('reset')} style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: colors.mute, fontSize: 14 }}>
              Mot de passe oublié ?{' '}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Réinitialiser</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* Basculer mode */}
        <TouchableOpacity
          onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          style={{ alignItems: 'center', marginTop: mode === 'login' ? 8 : 20 }}
        >
          <Text style={{ color: colors.text2, fontSize: 14 }}>
            {mode === 'signup' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              {mode === 'signup' ? 'Connexion' : 'Inscription'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
