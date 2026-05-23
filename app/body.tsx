import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Circle, Path, G, Ellipse } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { loadWeeklyVolume, type VolumeMap } from '../lib/muscleVolume';

const { width: SCREEN_W } = Dimensions.get('window');
const SVG_W = 200;
const SVG_H = 430;
const DISPLAY_W = Math.min(SCREEN_W - 64, 260);
const DISPLAY_H = (DISPLAY_W / SVG_W) * SVG_H;

// ── Muscle metadata (volume comes live from muscle_volume_weeks) ──────────────
const MUSCLES: Record<string, { label: string; group: string; side: 'front' | 'back' | 'both' }> = {
  pec_upper:   { label: 'Pectoral supérieur', group: 'Pectoraux', side: 'front' },
  pec_mid:     { label: 'Pectoral moyen',     group: 'Pectoraux', side: 'front' },
  pec_lower:   { label: 'Pectoral inférieur', group: 'Pectoraux', side: 'front' },
  delt_front:  { label: 'Deltoïde antérieur', group: 'Épaules',   side: 'front' },
  delt_side:   { label: 'Deltoïde latéral',   group: 'Épaules',   side: 'both'  },
  delt_rear:   { label: 'Deltoïde postérieur',group: 'Épaules',   side: 'back'  },
  traps:       { label: 'Trapèzes',           group: 'Dos',       side: 'back'  },
  lats:        { label: 'Grand dorsal',       group: 'Dos',       side: 'back'  },
  lower_back:  { label: 'Lombaires',          group: 'Dos',       side: 'back'  },
  biceps:      { label: 'Biceps',             group: 'Bras',      side: 'front' },
  triceps:     { label: 'Triceps',            group: 'Bras',      side: 'back'  },
  forearms:    { label: 'Avant-bras',         group: 'Bras',      side: 'both'  },
  abs_upper:   { label: 'Abdominaux sup.',    group: 'Abdos',     side: 'front' },
  abs_lower:   { label: 'Abdominaux inf.',    group: 'Abdos',     side: 'front' },
  obliques:    { label: 'Obliques',           group: 'Abdos',     side: 'front' },
  quads:       { label: 'Quadriceps',         group: 'Jambes',    side: 'front' },
  glutes:      { label: 'Fessiers',           group: 'Jambes',    side: 'back'  },
  hamstrings:  { label: 'Ischio-jambiers',    group: 'Jambes',    side: 'back'  },
  calves:      { label: 'Mollets',            group: 'Jambes',    side: 'both'  },
};

// ── Heat color based on % of weekly volume ───────────────────────────────────
function heatOpacity(pct: number) {
  if (pct >= 12) return 0.95;
  if (pct >= 7)  return 0.75;
  if (pct >= 3)  return 0.55;
  if (pct >= 1)  return 0.35;
  return 0.15;
}

const JOINT   = '#0d0d12';
const NEUTRAL = '#1c1c24';

type BodyProps = {
  accent: string;
  selected: string | null;
  onSelect: (id: string) => void;
  vol: VolumeMap;
};

// ── SVG Body Components ──────────────────────────────────────────────────────
function FrontBody({ accent, selected, onSelect, vol }: BodyProps) {
  const op = (id: string) => (selected === id ? 1 : heatOpacity(vol[id] ?? 0));
  const sw = (id: string) => (selected === id ? '#fff' : 'none');

  return (
    <G>
      <Circle cx={100} cy={32} r={22} fill={NEUTRAL} />
      <Rect x={91} y={53} width={18} height={14} rx={5} fill={NEUTRAL} />

      <Circle cx={51} cy={80} r={11} fill={JOINT} />
      <Circle cx={149} cy={80} r={11} fill={JOINT} />

      {/* Deltoïde antérieur */}
      <Ellipse cx={51} cy={82} rx={14} ry={16} fill={accent} opacity={op('delt_front')} stroke={sw('delt_front')} strokeWidth={1.5} onPress={() => onSelect('delt_front')} />
      <Ellipse cx={149} cy={82} rx={14} ry={16} fill={accent} opacity={op('delt_front')} stroke={sw('delt_front')} strokeWidth={1.5} onPress={() => onSelect('delt_front')} />

      {/* Pectoraux — 3 zones */}
      <Rect x={67} y={86} width={66} height={22} rx={8} fill={accent} opacity={op('pec_upper')} stroke={sw('pec_upper')} strokeWidth={1.5} onPress={() => onSelect('pec_upper')} />
      <Rect x={68} y={110} width={64} height={20} rx={2} fill={accent} opacity={op('pec_mid')} stroke={sw('pec_mid')} strokeWidth={1.5} onPress={() => onSelect('pec_mid')} />
      <Rect x={69} y={132} width={62} height={16} rx={8} fill={accent} opacity={op('pec_lower')} stroke={sw('pec_lower')} strokeWidth={1.5} onPress={() => onSelect('pec_lower')} />

      {/* Biceps */}
      <Rect x={30} y={92} width={20} height={55} rx={10} fill={accent} opacity={op('biceps')} stroke={sw('biceps')} strokeWidth={1.5} onPress={() => onSelect('biceps')} />
      <Rect x={150} y={92} width={20} height={55} rx={10} fill={accent} opacity={op('biceps')} stroke={sw('biceps')} strokeWidth={1.5} onPress={() => onSelect('biceps')} />

      <Circle cx={40} cy={152} r={8} fill={JOINT} />
      <Circle cx={160} cy={152} r={8} fill={JOINT} />

      {/* Avant-bras */}
      <Rect x={32} y={156} width={18} height={44} rx={9} fill={accent} opacity={op('forearms')} stroke={sw('forearms')} strokeWidth={1.5} onPress={() => onSelect('forearms')} />
      <Rect x={150} y={156} width={18} height={44} rx={9} fill={accent} opacity={op('forearms')} stroke={sw('forearms')} strokeWidth={1.5} onPress={() => onSelect('forearms')} />

      {/* Abdos */}
      <Rect x={80} y={150} width={18} height={14} rx={4} fill={accent} opacity={op('abs_upper')} stroke={sw('abs_upper')} strokeWidth={1} onPress={() => onSelect('abs_upper')} />
      <Rect x={102} y={150} width={18} height={14} rx={4} fill={accent} opacity={op('abs_upper')} onPress={() => onSelect('abs_upper')} />
      <Rect x={80} y={167} width={18} height={13} rx={4} fill={accent} opacity={op('abs_upper')} onPress={() => onSelect('abs_upper')} />
      <Rect x={102} y={167} width={18} height={13} rx={4} fill={accent} opacity={op('abs_upper')} onPress={() => onSelect('abs_upper')} />
      <Rect x={82} y={183} width={36} height={14} rx={5} fill={accent} opacity={op('abs_lower')} stroke={sw('abs_lower')} strokeWidth={1} onPress={() => onSelect('abs_lower')} />

      {/* Obliques */}
      <Rect x={63} y={150} width={15} height={48} rx={7} fill={accent} opacity={op('obliques')} stroke={sw('obliques')} strokeWidth={1} onPress={() => onSelect('obliques')} />
      <Rect x={122} y={150} width={15} height={48} rx={7} fill={accent} opacity={op('obliques')} onPress={() => onSelect('obliques')} />

      <Rect x={70} y={200} width={60} height={20} rx={8} fill={NEUTRAL} />
      <Circle cx={80} cy={224} r={10} fill={JOINT} />
      <Circle cx={120} cy={224} r={10} fill={JOINT} />

      {/* Quadriceps */}
      <Rect x={63} y={230} width={32} height={76} rx={14} fill={accent} opacity={op('quads')} stroke={sw('quads')} strokeWidth={1.5} onPress={() => onSelect('quads')} />
      <Rect x={105} y={230} width={32} height={76} rx={14} fill={accent} opacity={op('quads')} onPress={() => onSelect('quads')} />

      <Circle cx={79} cy={310} r={10} fill={JOINT} />
      <Circle cx={121} cy={310} r={10} fill={JOINT} />

      {/* Mollets */}
      <Rect x={65} y={316} width={28} height={66} rx={13} fill={accent} opacity={op('calves')} stroke={sw('calves')} strokeWidth={1.5} onPress={() => onSelect('calves')} />
      <Rect x={107} y={316} width={28} height={66} rx={13} fill={accent} opacity={op('calves')} onPress={() => onSelect('calves')} />

      <Rect x={61} y={377} width={32} height={12} rx={5} fill={NEUTRAL} />
      <Rect x={107} y={377} width={32} height={12} rx={5} fill={NEUTRAL} />
    </G>
  );
}

function BackBody({ accent, selected, onSelect, vol }: BodyProps) {
  const op = (id: string) => (selected === id ? 1 : heatOpacity(vol[id] ?? 0));
  const sw = (id: string) => (selected === id ? '#fff' : 'none');

  return (
    <G>
      <Circle cx={100} cy={32} r={22} fill={NEUTRAL} />
      <Rect x={91} y={53} width={18} height={14} rx={5} fill={NEUTRAL} />

      {/* Trapèzes */}
      <Path d="M 88,66 L 112,66 Q 138,76 146,90 L 54,90 Q 62,76 88,66 Z" fill={accent} opacity={op('traps')} stroke={sw('traps')} strokeWidth={1.5} onPress={() => onSelect('traps')} />

      <Circle cx={51} cy={80} r={11} fill={JOINT} />
      <Circle cx={149} cy={80} r={11} fill={JOINT} />
      {/* Deltoïde postérieur */}
      <Ellipse cx={51} cy={82} rx={14} ry={16} fill={accent} opacity={op('delt_rear')} stroke={sw('delt_rear')} strokeWidth={1.5} onPress={() => onSelect('delt_rear')} />
      <Ellipse cx={149} cy={82} rx={14} ry={16} fill={accent} opacity={op('delt_rear')} onPress={() => onSelect('delt_rear')} />

      {/* Grand dorsal */}
      <Rect x={38} y={90} width={28} height={70} rx={12} fill={accent} opacity={op('lats')} stroke={sw('lats')} strokeWidth={1.5} onPress={() => onSelect('lats')} />
      <Rect x={134} y={90} width={28} height={70} rx={12} fill={accent} opacity={op('lats')} onPress={() => onSelect('lats')} />

      {/* Lombaires */}
      <Rect x={84} y={158} width={32} height={38} rx={10} fill={accent} opacity={op('lower_back')} stroke={sw('lower_back')} strokeWidth={1.5} onPress={() => onSelect('lower_back')} />

      {/* Triceps */}
      <Rect x={30} y={92} width={20} height={55} rx={10} fill={accent} opacity={op('triceps')} stroke={sw('triceps')} strokeWidth={1.5} onPress={() => onSelect('triceps')} />
      <Rect x={150} y={92} width={20} height={55} rx={10} fill={accent} opacity={op('triceps')} onPress={() => onSelect('triceps')} />

      <Circle cx={40} cy={152} r={8} fill={JOINT} />
      <Circle cx={160} cy={152} r={8} fill={JOINT} />

      {/* Avant-bras */}
      <Rect x={32} y={156} width={18} height={44} rx={9} fill={accent} opacity={op('forearms')} stroke={sw('forearms')} strokeWidth={1.5} onPress={() => onSelect('forearms')} />
      <Rect x={150} y={156} width={18} height={44} rx={9} fill={accent} opacity={op('forearms')} onPress={() => onSelect('forearms')} />

      <Rect x={70} y={200} width={60} height={20} rx={8} fill={NEUTRAL} />
      <Circle cx={82} cy={222} r={9} fill={JOINT} />
      <Circle cx={118} cy={222} r={9} fill={JOINT} />

      {/* Fessiers */}
      <Rect x={68} y={218} width={30} height={40} rx={14} fill={accent} opacity={op('glutes')} stroke={sw('glutes')} strokeWidth={1.5} onPress={() => onSelect('glutes')} />
      <Rect x={102} y={218} width={30} height={40} rx={14} fill={accent} opacity={op('glutes')} onPress={() => onSelect('glutes')} />

      {/* Ischio-jambiers */}
      <Rect x={66} y={256} width={30} height={50} rx={14} fill={accent} opacity={op('hamstrings')} stroke={sw('hamstrings')} strokeWidth={1.5} onPress={() => onSelect('hamstrings')} />
      <Rect x={104} y={256} width={30} height={50} rx={14} fill={accent} opacity={op('hamstrings')} onPress={() => onSelect('hamstrings')} />

      <Circle cx={81} cy={310} r={10} fill={JOINT} />
      <Circle cx={119} cy={310} r={10} fill={JOINT} />

      {/* Mollets */}
      <Rect x={65} y={316} width={28} height={66} rx={13} fill={accent} opacity={op('calves')} stroke={sw('calves')} strokeWidth={1.5} onPress={() => onSelect('calves')} />
      <Rect x={107} y={316} width={28} height={66} rx={13} fill={accent} opacity={op('calves')} onPress={() => onSelect('calves')} />

      <Rect x={62} y={377} width={30} height={12} rx={5} fill={NEUTRAL} />
      <Rect x={108} y={377} width={30} height={12} rx={5} fill={NEUTRAL} />
    </G>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function BodyScreen() {
  const colors = useTheme();
  const [view, setView] = useState<'front' | 'back'>('front');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [vol, setVol] = useState<VolumeMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      try {
        const v = await loadWeeklyVolume(user.id);
        setVol(v);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedMuscle = selected ? MUSCLES[selected] : null;
  const selectedPct = selected ? (vol[selected] ?? 0) : 0;
  const hasData = Object.keys(vol).length > 0;

  // Group totals for the breakdown list
  const groups: Record<string, { total: number; items: { id: string; label: string; pct: number }[] }> = {};
  Object.entries(MUSCLES).forEach(([id, m]) => {
    const pct = vol[id] ?? 0;
    if (!groups[m.group]) groups[m.group] = { total: 0, items: [] };
    groups[m.group].total += pct;
    groups[m.group].items.push({ id, label: m.label, pct });
  });
  Object.values(groups).forEach((g) => { g.total = Math.round(g.total * 10) / 10; });
  const ordered = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);

  // Smart advice: most & least trained groups
  const trained = ordered.filter(([, d]) => d.total > 0);
  const top = trained[0];
  const weak = ordered.filter(([, d]) => d.total < 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 }}>Analyse musculaire</Text>
        </View>

        <Card padding={16} style={{ marginHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: colors.mute, fontWeight: '600' }}>7 derniers jours</Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 10, padding: 3 }}>
              {(['front', 'back'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => { setView(v); setSelected(null); }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: view === v ? colors.accent : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: view === v ? colors.accentInk : colors.mute }}>
                    {v === 'front' ? 'Face' : 'Dos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loading ? (
            <View style={{ height: DISPLAY_H, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Svg width={DISPLAY_W} height={DISPLAY_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                {view === 'front'
                  ? <FrontBody accent={colors.accent} selected={selected} onSelect={setSelected} vol={vol} />
                  : <BackBody  accent={colors.accent} selected={selected} onSelect={setSelected} vol={vol} />
                }
              </Svg>
            </View>
          )}

          {selectedMuscle ? (
            <View style={{ marginTop: 16, backgroundColor: colors.surface2, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 10, color: colors.mute, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 }}>{selectedMuscle.group}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 }}>{selectedMuscle.label}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.accent }}>{selectedPct}%</Text>
                <Text style={{ fontSize: 10, color: colors.mute }}>du volume hebdo</Text>
              </View>
            </View>
          ) : (
            <Text style={{ textAlign: 'center', fontSize: 12, color: colors.mute, marginTop: 12 }}>
              {hasData ? 'Appuie sur un muscle pour voir le détail' : 'Termine des séances pour alimenter ton analyse'}
            </Text>
          )}
        </Card>

        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Détail par groupe
          </Text>

          {!hasData && !loading ? (
            <Card padding={20} style={{ alignItems: 'center', gap: 10 }}>
              <Ionicons name="barbell-outline" size={40} color={colors.mute} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                Aucune donnée d'entraînement
              </Text>
              <Text style={{ fontSize: 12, color: colors.mute, textAlign: 'center' }}>
                Tes volumes par muscle apparaîtront ici après tes premières séances.
              </Text>
            </Card>
          ) : (
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {ordered.map(([group, data], i) => {
                const open = expanded === group;
                return (
                  <View key={group} style={{ borderBottomWidth: i < ordered.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <TouchableOpacity
                      onPress={() => setExpanded(open ? null : group)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.accent, opacity: heatOpacity(data.total) }} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>{group}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>{data.total}%</Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mute} />
                    </TouchableOpacity>
                    {open && (
                      <View style={{ paddingLeft: 36, paddingRight: 14, paddingBottom: 14, gap: 10 }}>
                        {data.items.sort((a, b) => b.pct - a.pct).map((m) => (
                          <View key={m.id}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 13, color: colors.text2 }}>{m.label}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: m.pct === 0 ? colors.danger : colors.text }}>{m.pct}%</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden' }}>
                              <View style={{ height: '100%', width: `${Math.min(100, m.pct * 7)}%`, backgroundColor: colors.accent, opacity: heatOpacity(m.pct + 2), borderRadius: 2 }} />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          )}

          {hasData && (
            <Card padding={14} style={{ borderColor: `${colors.warn}40`, borderWidth: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warn, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>⚡ Conseil Salle</Text>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
                {top && (
                  <>
                    <Text style={{ fontWeight: '700' }}>{top[0]}</Text> est ton groupe le plus stimulé ({top[1].total}%).{' '}
                  </>
                )}
                {weak.length > 0 ? (
                  <>
                    Sous-entraîné :{' '}
                    <Text style={{ color: colors.warn }}>
                      {weak.slice(0, 2).map(([g, d]) => `${g} (${d.total}%)`).join(', ')}
                    </Text>
                    {' '}— pense à rééquilibrer.
                  </>
                ) : (
                  'Bel équilibre général entre les groupes musculaires 💪'
                )}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/program/generate')}
                style={{ marginTop: 10, backgroundColor: colors.accent, borderRadius: 10, padding: 10, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentInk, fontWeight: '700', fontSize: 13 }}>Rééquilibrer le programme</Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
