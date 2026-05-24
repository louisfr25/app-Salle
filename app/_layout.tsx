import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store/useAppStore';
import { configureNotifications, requestPermissions, initDailyReminders } from '../lib/notifications';
import type { Profile } from '../lib/database.types';

// Durée max avant d'afficher l'app même sans réponse Supabase (ex: réseau indisponible)
const AUTH_TIMEOUT_MS = 3000;

export default function RootLayout() {
  const setProfile = useAppStore((s) => s.setProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Local notifications — jamais bloquant
    (async () => {
      try {
        await configureNotifications();
        await requestPermissions();
        await initDailyReminders();
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    // Filet de sécurité : révèle l'app après AUTH_TIMEOUT_MS quoi qu'il arrive
    const safetyTimer = setTimeout(() => setReady(true), AUTH_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(safetyTimer);

        if (session?.user) {
          // Charge le profil AVANT d'afficher l'app pour détecter l'onboarding
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            setProfile(data as Profile);
            useAppStore.getState().setPalette((data as Profile).palette ?? 'volt');
            setReady(true);
            // Si l'utilisateur n'a pas encore choisi son objectif → onboarding
            if (!data.goal) {
              router.replace('/onboarding' as any);
            }
          } else {
            // Profil introuvable → premier lancement, onboarding
            setReady(true);
            router.replace('/onboarding' as any);
          }
        } else {
          // Non authentifié → écran de connexion
          setReady(true);
        }
      })
      .catch(() => {
        // Erreur réseau → on affiche quand même l'app
        setReady(true);
        clearTimeout(safetyTimer);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      } else if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Pendant l'initialisation : fond sombre avec indicateur discret
  // (évite l'écran noir "vide" qui fait croire à un crash)
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0B', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color="#C7FF3D" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
