/**
 * Galerie de progression — protégée par PIN.
 * Grille 2 colonnes · plein écran · sauvegarde téléphone · avant/après · suppression.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList,
  Modal, Alert, ActivityIndicator, Dimensions,
  PanResponder, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import {
  hasPIN, setPIN, verifyPIN, isUnlocked, lock, resetPIN,
} from '../lib/galleryPin';
import {
  loadAllPhotos, deleteWorkoutPhoto, type WorkoutPhoto,
} from '../lib/workoutPhotos';

const { width: W } = Dimensions.get('window');
const THUMB = (W - 16 * 2 - 8) / 2;

// ── Miniature photo avec états loading / error ───────────────────────
function PhotoThumb({ uri, colors }: { uri: string; colors: any }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <View style={{ width: '100%', height: '100%', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.mute} />
        <Text style={{ fontSize: 10, color: colors.mute, marginTop: 4 }}>Erreur</Text>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', height: '100%' }}>
      {!loaded && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%', opacity: loaded ? 1 : 0 }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </View>
  );
}

// ── Slider avant / après ─────────────────────────────────────────────
function CompareSlider({
  photoA,
  photoB,
  colors,
}: {
  photoA: WorkoutPhoto;
  photoB: WorkoutPhoto;
  colors: any;
}) {
  const MONTHS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Position du séparateur (pixels depuis la gauche)
  const splitPos  = useRef(W / 2);
  const splitAnim = useRef(new Animated.Value(W / 2)).current;

  // Reset à 50/50 quand les photos changent
  useEffect(() => {
    splitPos.current = W / 2;
    splitAnim.setValue(W / 2);
  }, [photoA.id, photoB.id]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gs) => {
        const next = Math.max(60, Math.min(W - 60, splitPos.current + gs.dx));
        splitAnim.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        splitPos.current = Math.max(60, Math.min(W - 60, splitPos.current + gs.dx));
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }}>
      {/* Photo B — fond entier */}
      {photoB.signedUrl ? (
        <Image
          source={{ uri: photoB.signedUrl }}
          style={{ position: 'absolute', width: W, height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ position: 'absolute', width: W, height: '100%', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
        </View>
      )}

      {/* Photo A — clippée à gauche du séparateur */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: splitAnim, overflow: 'hidden' }}>
        {photoA.signedUrl ? (
          <Image
            source={{ uri: photoA.signedUrl }}
            style={{ width: W, height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: W, height: '100%', backgroundColor: '#222' }} />
        )}
      </Animated.View>

      {/* Ligne séparatrice */}
      <Animated.View
        style={{
          position: 'absolute',
          left: Animated.subtract(splitAnim, 1),
          top: 0, bottom: 0, width: 2,
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
        pointerEvents="none"
      />

      {/* Handle draggable */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute',
          left: Animated.subtract(splitAnim, 22),
          top: 0, bottom: 0, width: 44,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: 'white',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          elevation: 8,
        }}>
          <Ionicons name="swap-horizontal" size={20} color="#111" />
        </View>
      </Animated.View>

      {/* Label AVANT (gauche) */}
      <View style={{ position: 'absolute', bottom: 56, left: 16, zIndex: 5 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>AVANT</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 1 }}>{fmtDate(photoA.created_at)}</Text>
        </View>
      </View>

      {/* Label APRÈS (droite) */}
      <View style={{ position: 'absolute', bottom: 56, right: 16, zIndex: 5, alignItems: 'flex-end' }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'flex-end' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>APRÈS</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 1 }}>{fmtDate(photoB.created_at)}</Text>
        </View>
      </View>

      {/* Hint glisser */}
      <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>← Glisse pour comparer →</Text>
        </View>
      </View>
    </View>
  );
}

// ── Écran PIN (création ou vérification) ─────────────────────────────
function PinScreen({
  mode, onSuccess, colors,
}: { mode: 'create' | 'verify'; onSuccess: () => void; colors: any }) {
  const [pin, setPin]           = useState('');
  const [confirm, setConfirm]   = useState('');
  const [step, setStep]         = useState<'enter' | 'confirm'>('enter');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleDigit = (d: string) => {
    if (mode === 'create' && step === 'confirm') {
      const next = confirm + d;
      setConfirm(next);
      if (next.length === 4) confirmCreate(next);
    } else {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        if (mode === 'create') { setStep('confirm'); }
        else verify(next);
      }
    }
  };

  const del = () => {
    if (mode === 'create' && step === 'confirm') setConfirm((c) => c.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
  };

  const verify = async (p: string) => {
    setLoading(true);
    const ok = await verifyPIN(p);
    setLoading(false);
    if (ok) { onSuccess(); }
    else { setError('Code incorrect. Réessaie.'); setPin(''); }
  };

  const confirmCreate = async (c: string) => {
    if (c !== pin) {
      setError('Les codes ne correspondent pas.');
      setConfirm('');
      setPin('');
      setStep('enter');
      return;
    }
    await setPIN(pin);
    onSuccess();
  };

  const handleForgot = () => {
    Alert.alert(
      'Mot de passe oublié ?',
      'Un email de réinitialisation va être envoyé à ton adresse. Ton accès à la galerie sera temporairement désactivé jusqu\'à la réinitialisation.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer l\'email',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const email = session?.user?.email;
            if (!email) { Alert.alert('Erreur', 'Non connecté.'); return; }
            await supabase.auth.resetPasswordForEmail(email);
            await resetPIN();
            Alert.alert(
              '📩 Email envoyé',
              'Vérifie ta boîte mail. Après réinitialisation, tu pourras créer un nouveau code PIN.',
            );
          },
        },
      ],
    );
  };

  const current = (mode === 'create' && step === 'confirm') ? confirm : pin;
  const label = mode === 'create'
    ? step === 'enter' ? 'Crée ton code PIN (4 chiffres)' : 'Confirme ton code PIN'
    : 'Entre ton code PIN';
  const sublabel = mode === 'create' && step === 'enter'
    ? 'Ce code protège ta galerie de progression'
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 32 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.accent}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${colors.accent}30` }}>
          <Ionicons name="lock-closed" size={28} color={colors.accent} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 13, color: colors.mute, textAlign: 'center' }}>{sublabel}</Text> : null}
      </View>

      {/* Indicateur 4 points */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {[0,1,2,3].map((i) => (
          <View key={i} style={{
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: i < current.length ? colors.accent : colors.surface2,
            borderWidth: 1.5, borderColor: i < current.length ? colors.accent : colors.border,
          }} />
        ))}
      </View>

      {error ? (
        <Text style={{ fontSize: 13, color: colors.danger, fontWeight: '600' }}>{error}</Text>
      ) : null}

      {loading && <ActivityIndicator color={colors.accent} />}

      {/* Clavier numérique */}
      <View style={{ width: '100%', gap: 12 }}>
        {[[1,2,3],[4,5,6],[7,8,9],['',0,'⌫']].map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
            {row.map((d, di) => (
              <TouchableOpacity
                key={di}
                onPress={() => d === '⌫' ? del() : d !== '' ? handleDigit(String(d)) : null}
                disabled={loading}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: d === '' ? 'transparent' : colors.surface,
                  borderWidth: d === '' ? 0 : 1, borderColor: colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: d === '⌫' ? 20 : 24, fontWeight: '600', color: colors.text }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {mode === 'verify' && (
        <TouchableOpacity onPress={handleForgot} style={{ padding: 8 }}>
          <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>Code oublié ?</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────
export default function GalleryScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [pinState, setPinState]     = useState<'loading' | 'create' | 'verify' | 'unlocked'>('loading');
  const [photos, setPhotos]         = useState<WorkoutPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Plein écran
  const [viewer, setViewer]         = useState<WorkoutPhoto | null>(null);
  const [viewerIdx, setViewerIdx]   = useState(0);

  // Avant/après
  const [compareMode, setCompareMode]     = useState(false);
  const [compareA, setCompareA]           = useState<WorkoutPhoto | null>(null);
  const [compareB, setCompareB]           = useState<WorkoutPhoto | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // ── Initialisation PIN ────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    (async () => {
      if (isUnlocked()) {
        setPinState('unlocked');
        fetchPhotos();
        return;
      }
      const has = await hasPIN();
      setPinState(has ? 'verify' : 'create');
    })();
    return () => lock();
  }, []));

  const onPinSuccess = () => {
    setPinState('unlocked');
    fetchPhotos();
  };

  // ── Chargement photos ─────────────────────────────────────────────
  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoadingPhotos(false); return; }
    const ps = await loadAllPhotos(user.id);
    setPhotos(ps);
    setLoadingPhotos(false);
  };

  // ── Sauvegarde sur le téléphone ───────────────────────────────────
  const saveToPhone = async (photo: WorkoutPhoto) => {
    if (!photo.signedUrl) { Alert.alert('Erreur', 'URL expirée, reviens dans la galerie.'); return; }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Active l\'accès à la galerie dans les paramètres.');
      return;
    }
    try {
      // Télécharger dans le cache puis créer un asset media (API legacy, stable dans Expo Go)
      const localUri = (FileSystem.cacheDirectory ?? '') + `salle_${Date.now()}.jpg`;
      await FileSystem.downloadAsync(photo.signedUrl!, localUri);
      const asset = await MediaLibrary.createAssetAsync(localUri);
      await MediaLibrary.createAlbumAsync('Salle — Progression', asset, false);
      Alert.alert('✅ Photo enregistrée', 'La photo a été ajoutée à l\'album "Salle — Progression".');
    } catch (e) {
      if (__DEV__) console.error('saveToPhone', e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la photo.');
    }
  };

  // ── Suppression ───────────────────────────────────────────────────
  const confirmDelete = (photo: WorkoutPhoto) => {
    Alert.alert(
      'Supprimer cette photo ?',
      'Elle sera définitivement supprimée de la galerie.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            await deleteWorkoutPhoto(photo);
            setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
            if (viewer?.id === photo.id) setViewer(null);
            if (compareA?.id === photo.id) setCompareA(null);
            if (compareB?.id === photo.id) setCompareB(null);
          },
        },
      ],
    );
  };

  // ── Mode avant/après ──────────────────────────────────────────────
  const toggleCompareSelect = (photo: WorkoutPhoto) => {
    if (!compareA) { setCompareA(photo); return; }
    if (compareA.id === photo.id) { setCompareA(null); return; }
    if (!compareB) { setCompareB(photo); return; }
    if (compareB.id === photo.id) { setCompareB(null); return; }
    // Remplace B
    setCompareB(photo);
  };

  // ── Verrou manuel ─────────────────────────────────────────────────
  const handleLock = () => {
    Alert.alert('Verrouiller la galerie ?', '', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Verrouiller', onPress: () => { lock(); setPinState('verify'); } },
    ]);
  };

  // ── États de chargement / PIN ─────────────────────────────────────
  if (pinState === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (pinState === 'create' || pinState === 'verify') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginLeft: 8 }}>Galerie</Text>
        </View>
        <PinScreen mode={pinState} onSuccess={onPinSuccess} colors={colors} />
      </SafeAreaView>
    );
  }

  // ── Galerie déverrouillée ─────────────────────────────────────────
  const MONTHS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Ma galerie</Text>
          <Text style={{ fontSize: 11, color: colors.mute }}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Mode avant/après */}
          <TouchableOpacity
            onPress={() => { setCompareMode((m) => !m); setCompareA(null); setCompareB(null); }}
            style={{ backgroundColor: compareMode ? colors.accent : colors.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: compareMode ? colors.accent : colors.border }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: compareMode ? colors.accentInk : colors.text }}>
              {compareMode ? '✕ Comparer' : '⇔ Comparer'}
            </Text>
          </TouchableOpacity>
          {/* Verrouiller */}
          <TouchableOpacity onPress={handleLock} style={{ padding: 6 }}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.mute} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Avant/après sélection */}
      {compareMode && (
        <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.mute }}>
            Sélectionne 2 photos pour les comparer · {compareA && compareB ? 'Appuie sur "Voir" →' : `${compareA ? '1' : '0'}/2 sélectionnée${compareA ? '' : 's'}`}
          </Text>
          {compareA && compareB && (
            <TouchableOpacity
              onPress={() => setCompareModalOpen(true)}
              style={{ backgroundColor: colors.accent, borderRadius: 10, padding: 10, alignItems: 'center' }}
            >
              <Text style={{ color: colors.accentInk, fontWeight: '700' }}>Voir la comparaison →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loadingPhotos ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : photos.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 48 }}>📸</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' }}>Aucune photo encore</Text>
          <Text style={{ fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 20 }}>
            Ajoute des photos pendant tes séances pour suivre ta progression !
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: photo, index }) => {
            const isSelectedA = compareA?.id === photo.id;
            const isSelectedB = compareB?.id === photo.id;
            const isSelected  = isSelectedA || isSelectedB;
            return (
              <TouchableOpacity
                onPress={() => {
                  if (compareMode) {
                    toggleCompareSelect(photo);
                  } else {
                    setViewer(photo);
                    setViewerIdx(index);
                  }
                }}
                activeOpacity={0.85}
                style={{ width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
              >
                {photo.signedUrl ? (
                  <PhotoThumb uri={photo.signedUrl} colors={colors} />
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={32} color={colors.mute} />
                  </View>
                )}
                {/* Date overlay */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 6 }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>{fmtDate(photo.created_at)}</Text>
                </View>
                {/* Sélection avant/après */}
                {compareMode && (
                  <View style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: isSelected ? colors.accent : 'rgba(0,0,0,0.5)',
                    borderWidth: 2, borderColor: isSelected ? colors.accent : 'rgba(255,255,255,0.6)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && (
                      <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: '900' }}>
                        {isSelectedA ? 'A' : 'B'}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Bouton voir comparaison flottant */}
      {compareMode && compareA && compareB && (
        <TouchableOpacity
          onPress={() => setCompareModalOpen(true)}
          style={{ position: 'absolute', bottom: 32, left: 24, right: 24, backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>⇔ Voir avant / après</Text>
        </TouchableOpacity>
      )}

      {/* ══ Modal : vue plein écran ══════════════════════════════════ */}
      <Modal visible={!!viewer} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header — paddingTop manuel pour éviter le problème SafeAreaView dans Modal */}
          <View style={{ paddingTop: insets.top + 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <TouchableOpacity onPress={() => setViewer(null)} style={{ padding: 8 }}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                {viewer ? fmtDate(viewer.created_at) : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <TouchableOpacity onPress={() => viewer && saveToPhone(viewer)} style={{ padding: 8 }}>
                  <Ionicons name="download-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => viewer && confirmDelete(viewer)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={22} color="#FF5468" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Image plein écran */}
          {viewer?.signedUrl && (
            <Image
              source={{ uri: viewer.signedUrl }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}

          {/* Navigation ← → */}
          <SafeAreaView edges={['bottom']}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
              <TouchableOpacity
                onPress={() => { const prev = photos[viewerIdx - 1]; if (prev) { setViewer(prev); setViewerIdx(viewerIdx - 1); } }}
                disabled={viewerIdx === 0}
                style={{ opacity: viewerIdx === 0 ? 0.2 : 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>← Précédente</Text>
              </TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, alignSelf: 'center' }}>
                {viewerIdx + 1} / {photos.length}
              </Text>
              <TouchableOpacity
                onPress={() => { const next = photos[viewerIdx + 1]; if (next) { setViewer(next); setViewerIdx(viewerIdx + 1); } }}
                disabled={viewerIdx === photos.length - 1}
                style={{ opacity: viewerIdx === photos.length - 1 ? 0.2 : 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Suivante →</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ══ Modal : avant / après ════════════════════════════════════ */}
      <Modal visible={compareModalOpen} animationType="slide" onRequestClose={() => setCompareModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header — paddingTop manuel pour éviter le problème SafeAreaView dans Modal */}
          <View style={{ paddingTop: insets.top + 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <TouchableOpacity onPress={() => setCompareModalOpen(false)} style={{ padding: 8 }}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                Avant / Après
              </Text>
              <View style={{ width: 42 }} />
            </View>
          </View>

          {/* Slider avant/après draggable */}
          {compareA && compareB && (
            <CompareSlider
              key={`${compareA.id}-${compareB.id}`}
              photoA={compareA}
              photoB={compareB}
              colors={colors}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
