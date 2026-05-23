/**
 * Onglet Entraînement
 *  - Séance libre (accès rapide)
 *  - Liste de tous les programmes avec :
 *      · Badge "Actif" sur le programme courant
 *      · Bouton "Activer" en 1 tap pour changer de programme
 *      · Tap sur la carte → édition du programme
 *      · Tap sur une séance → démarrer directement
 *  - Créer un nouveau programme :
 *      · IA (generate screen)
 *      · Manuel (modale nom + jours → programme vide prêt à éditer)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import type { ProgramSession, Program } from '../../lib/database.types';

type FullProgram = Program & { program_sessions: ProgramSession[] };

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

export default function TrainScreen() {
  const colors = useTheme();
  const [programs, setPrograms]   = useState<FullProgram[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activating, setActivating] = useState<string | null>(null); // id en cours d'activation

  // Modale création manuelle
  const [createModal, setCreateModal] = useState(false);
  const [progName, setProgName]       = useState('');
  const [progDays, setProgDays]       = useState(3);
  const [creating, setCreating]       = useState(false);

  // ── Chargement ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { data } = await supabase
      .from('programs')
      .select('*, program_sessions(*)')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
    setPrograms((data ?? []) as FullProgram[]);
    setLoading(false);
  }, []);

  // Recharge à chaque fois que l'onglet devient actif
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Activer un programme ──────────────────────────────────────────
  const activate = async (progId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    setActivating(progId);
    await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);
    await supabase.from('programs').update({ is_active: true }).eq('id', progId);
    await load();
    setActivating(null);
  };

  // ── Créer un programme manuel ─────────────────────────────────────
  const createManual = async () => {
    const name = progName.trim();
    if (!name) { Alert.alert('Nom requis', 'Donne un nom à ton programme.'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    setCreating(true);
    try {
      // 1. Désactiver les autres programmes
      await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);

      // 2. Créer le programme
      const { data: prog, error } = await supabase.from('programs').insert({
        user_id:      user.id,
        name,
        days_per_week: progDays,
        source:       'manual',
        is_active:    true,
        goal:         null,
        level:        null,
      }).select().single();

      if (error || !prog) throw error ?? new Error('Création échouée');

      // 3. Créer N séances vides
      const sessions = Array.from({ length: progDays }, (_, i) => ({
        program_id:   prog.id,
        name:         `Séance ${i + 1}`,
        day_index:    i,
        duration_min: 45,
      }));
      await supabase.from('program_sessions').insert(sessions);

      // 4. Fermer modale et naviguer vers l'éditeur
      setCreateModal(false);
      setProgName('');
      setProgDays(3);
      await load();
      router.push({ pathname: '/program', params: { id: prog.id, editMode: '1' } } as any);
    } catch (e) {
      if (__DEV__) console.error('createManual', e);
      Alert.alert('Erreur', 'La création a échoué. Réessaie.');
    } finally {
      setCreating(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
          Entraînement
        </Text>

        {/* Séance libre */}
        <TouchableOpacity
          onPress={() => router.push('/train/active')}
          style={{
            backgroundColor: colors.accent, borderRadius: 18, padding: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16,
          }}
        >
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${colors.accentInk}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26 }}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accentInk }}>Séance libre</Text>
            <Text style={{ fontSize: 13, color: `${colors.accentInk}B0`, marginTop: 2 }}>Choisis tes exercices librement</Text>
          </View>
          <Text style={{ fontSize: 20, color: colors.accentInk }}>→</Text>
        </TouchableOpacity>

        {/* En-tête "Mes programmes" + boutons créer */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Mes programmes
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { setProgName(''); setProgDays(3); setCreateModal(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="create-outline" size={14} color={colors.text} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Manuel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/program/generate' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 13 }}>✨</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accentInk }}>IA</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Liste des programmes */}
        {loading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : programs.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 32 }}>📋</Text>
            <Text style={{ fontSize: 15, color: colors.mute, textAlign: 'center' }}>
              Aucun programme pour l'instant.{'\n'}Crée-en un manuellement ou laisse l'IA le faire !
            </Text>
          </View>
        ) : (
          programs.map((prog) => {
            const isActive = prog.is_active;
            const isBeingActivated = activating === prog.id;
            const sortedSessions = [...prog.program_sessions].sort((a, b) => a.day_index - b.day_index);

            return (
              <View
                key={prog.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: isActive ? 2 : 1,
                  borderColor: isActive ? colors.accent : colors.border,
                  overflow: 'hidden',
                }}
              >
                {/* En-tête du programme */}
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/program', params: { id: prog.id } } as any)}
                  activeOpacity={0.8}
                  style={{ padding: 16, gap: 4 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{prog.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.mute, marginTop: 2 }}>
                        {prog.days_per_week}j/semaine · {prog.source === 'ai' ? '✨ IA' : '✏️ Manuel'}
                        {' · '}
                        {sortedSessions.length} séance{sortedSessions.length > 1 ? 's' : ''}
                      </Text>
                    </View>

                    {isActive ? (
                      <View style={{ backgroundColor: `${colors.accent}20`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>Actif</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => activate(prog.id)}
                        disabled={!!activating}
                        style={{ backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        {isBeingActivated
                          ? <ActivityIndicator size="small" color={colors.accent} />
                          : <>
                              <Ionicons name="radio-button-on-outline" size={13} color={colors.accent} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>Activer</Text>
                            </>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Chips des séances → démarrer directement */}
                {sortedSessions.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {sortedSessions.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => router.push({ pathname: '/train/active', params: { sessionId: s.id } })}
                        style={{
                          backgroundColor: isActive ? `${colors.accent}15` : colors.surface2,
                          borderRadius: 10, borderWidth: 1,
                          borderColor: isActive ? `${colors.accent}40` : colors.border,
                          paddingHorizontal: 12, paddingVertical: 8,
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Ionicons name="play-circle-outline" size={14} color={isActive ? colors.accent : colors.mute} />
                        <View>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? colors.accent : colors.text }}>{s.name}</Text>
                          <Text style={{ fontSize: 10, color: colors.mute }}>{s.duration_min} min</Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* Modifier le programme */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/program', params: { id: prog.id } } as any)}
                      style={{
                        backgroundColor: colors.surface2, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border,
                        paddingHorizontal: 12, paddingVertical: 8,
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Ionicons name="pencil-outline" size={14} color={colors.mute} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mute }}>Modifier</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Info historique par exercice */}
        <View style={{ backgroundColor: `${colors.accent}10`, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: `${colors.accent}25`, flexDirection: 'row', gap: 10 }}>
          <Text style={{ fontSize: 16 }}>📊</Text>
          <Text style={{ flex: 1, fontSize: 12, color: colors.text2, lineHeight: 18 }}>
            <Text style={{ fontWeight: '700', color: colors.accent }}>Tes poids sont sauvegardés par exercice</Text>
            {' '}— pas par programme. En changeant de programme tu conserves tout ton historique et tes records sur chaque exercice.
          </Text>
        </View>
      </ScrollView>

      {/* ══ Modale création manuelle ══════════════════════════════════ */}
      <Modal
        visible={createModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
            borderWidth: 1, borderColor: colors.border,
            gap: 18,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>
                Nouveau programme
              </Text>
              <TouchableOpacity onPress={() => setCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.mute} />
              </TouchableOpacity>
            </View>

            {/* Nom */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Nom du programme
              </Text>
              <TextInput
                value={progName}
                onChangeText={setProgName}
                placeholder="Ex : Push Pull Legs, Full Body…"
                placeholderTextColor={colors.mute}
                maxLength={50}
                autoFocus
                style={{
                  backgroundColor: colors.surface2,
                  borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                  padding: 14, color: colors.text, fontSize: 15,
                }}
              />
            </View>

            {/* Jours par semaine */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Jours d'entraînement par semaine
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {DAYS_OPTIONS.map((d) => {
                  const active = progDays === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setProgDays(d)}
                      style={{
                        flex: 1, height: 52, borderRadius: 12,
                        backgroundColor: active ? colors.accent : colors.surface2,
                        borderWidth: 1.5, borderColor: active ? colors.accent : colors.border,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '800', color: active ? colors.accentInk : colors.text }}>{d}</Text>
                      <Text style={{ fontSize: 9, color: active ? colors.accentInk : colors.mute, marginTop: 1 }}>j/sem</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text style={{ fontSize: 12, color: colors.mute, textAlign: 'center' }}>
              {progDays} séance{progDays > 1 ? 's' : ''} vide{progDays > 1 ? 's' : ''} seront créées — tu pourras ajouter tes exercices ensuite.
            </Text>

            <TouchableOpacity
              onPress={createManual}
              disabled={creating}
              style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', opacity: creating ? 0.7 : 1 }}
            >
              {creating
                ? <ActivityIndicator color={colors.accentInk} />
                : <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>
                    Créer et modifier →
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
