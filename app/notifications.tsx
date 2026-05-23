import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/ui/Card';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  hasPermission,
  notifyNow,
  scheduledCount,
} from '../lib/notifications';

const REMINDERS = [
  { icon: '⏱️', title: 'Fin de repos', desc: 'Alerte quand ton temps de repos est écoulé pendant une séance.' },
  { icon: '🔥', title: 'Rappel streak', desc: 'Chaque jour à 19h si tu n\'as pas encore entraîné.' },
  { icon: '💧', title: 'Hydratation', desc: 'Chaque jour à 14h pour penser à boire et logger ta journée.' },
];

export default function NotificationsScreen() {
  const colors = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [granted, setGranted] = useState(true);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    setEnabled(await getNotificationsEnabled());
    setGranted(await hasPermission());
    setCount(await scheduledCount());
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const toggle = async (v: boolean) => {
    setEnabled(v);
    await setNotificationsEnabled(v);
    await refresh();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Notifications</Text>
        </View>

        {/* Master toggle */}
        <Card padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Rappels & alertes</Text>
              <Text style={{ fontSize: 12, color: colors.mute }}>
                {enabled ? 'Activés' : 'Désactivés'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggle}
              trackColor={{ false: colors.surface3, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {!granted && enabled && (
            <View style={{ marginTop: 14, backgroundColor: `${colors.warn}18`, borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 12, color: colors.warn }}>
                ⚠️ Autorisation refusée. Active les notifications pour Salle dans les réglages de ton téléphone.
              </Text>
            </View>
          )}
        </Card>

        {/* Reminder types */}
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Types de rappels
        </Text>
        <Card padding={0} style={{ overflow: 'hidden', opacity: enabled ? 1 : 0.45 }}>
          {REMINDERS.map((r, i) => (
            <View
              key={r.title}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                borderBottomWidth: i < REMINDERS.length - 1 ? 1 : 0, borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 24 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{r.title}</Text>
                <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>{r.desc}</Text>
              </View>
              <Ionicons
                name={enabled ? 'checkmark-circle' : 'close-circle-outline'}
                size={20}
                color={enabled ? colors.success : colors.mute}
              />
            </View>
          ))}
        </Card>

        <Text style={{ fontSize: 11, color: colors.mute, textAlign: 'center' }}>
          {count > 0
            ? `${count} rappel${count > 1 ? 's' : ''} programmé${count > 1 ? 's' : ''}`
            : 'Aucun rappel programmé'}
        </Text>

        {enabled && (
          <TouchableOpacity
            onPress={() => notifyNow('🔔 Test', 'Tes notifications fonctionnent parfaitement !')}
            style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Envoyer une notification test</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
