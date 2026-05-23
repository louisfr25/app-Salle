import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../lib/store/useAppStore';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { getNotificationsEnabled, setNotificationsEnabled } from '../lib/notifications';

export default function SettingsScreen() {
  const colors = useTheme();
  const profile = useAppStore((s) => s.profile);
  const [haptics, setHaptics] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [units, setUnits] = useState(profile?.units === 'imperial' ? false : true); // true = metric
  const [notifs, setNotifs] = useState(true);

  useEffect(() => { getNotificationsEnabled().then(setNotifs); }, []);

  const toggleNotifs = async (v: boolean) => {
    setNotifs(v);
    await setNotificationsEnabled(v);
    if (v) {
      Alert.alert('Notifications activées', 'Tu recevras un rappel quotidien à 19h et une alerte de fin de repos pendant tes séances.');
    }
  };

  const updateUnits = async (metric: boolean) => {
    setUnits(metric);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    await supabase.from('profiles').update({ units: metric ? 'metric' : 'imperial' }).eq('id', user.id);
  };

  const deleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données (profil, séances, records…) seront définitivement supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          // Suppression réelle côté serveur (RGPD) via fonction
          // SECURITY DEFINER, puis déconnexion.
          const { error } = await supabase.rpc('delete_my_account');
          if (error) {
            if (__DEV__) console.error('delete_my_account', error);
            Alert.alert('Erreur', "La suppression a échoué. Réessaie plus tard.");
            return;
          }
          await supabase.auth.signOut();
          router.replace('/(auth)');
        }},
      ]
    );
  };

  const Row = ({ icon, label, value, onToggle, onPress }: { icon: string; label: string; value?: boolean; onToggle?: (v: boolean) => void; onPress?: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Ionicons name={icon as any} size={20} color={colors.accent} />
      <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{label}</Text>
      {onToggle !== undefined && value !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.surface3, true: colors.accent }}
          thumbColor="#fff"
        />
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.mute} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Paramètres</Text>
        </View>

        {/* Training */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>ENTRAÎNEMENT</Text>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <Row icon="phone-portrait-outline" label="Vibrations" value={haptics} onToggle={setHaptics} />
          <Row icon="volume-medium-outline" label="Sons" value={sounds} onToggle={setSounds} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="scale-outline" label="Unités métriques (kg/cm)" value={units} onToggle={updateUnits} />
          </View>
        </Card>

        {/* Notifications */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>NOTIFICATIONS</Text>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <Row icon="notifications-outline" label="Rappels & alertes" value={notifs} onToggle={toggleNotifs} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="options-outline" label="Gérer les notifications" onPress={() => router.push('/notifications' as any)} />
          </View>
        </Card>

        {/* Account */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>COMPTE</Text>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <Row icon="person-outline" label="Modifier le profil" onPress={() => router.push('/edit-profile' as any)} />
          <Row icon="cloud-upload-outline" label="Exporter mes données" onPress={() => Alert.alert('Export', 'Fonctionnalité à venir.')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="lock-closed-outline" label="Changer le mot de passe" onPress={() => router.push('/change-password' as any)} />
          </View>
        </Card>

        {/* About */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>INFOS</Text>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <Row icon="information-circle-outline" label="Version" onPress={() => {}} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="document-text-outline" label="Conditions d'utilisation" onPress={() => {}} />
          </View>
        </Card>

        {/* Danger zone */}
        <TouchableOpacity
          onPress={deleteAccount}
          style={{ backgroundColor: `${colors.danger}15`, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: `${colors.danger}30` }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Supprimer mon compte</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
