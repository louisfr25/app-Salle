import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

export interface BarItem {
  label: string;
  value: number;
  highlight?: boolean;
}

interface Props {
  data: BarItem[];
  height?: number;
  unit?: string;
}

/**
 * Lightweight bar chart (react-native-svg). Y auto-scales to max.
 */
export function BarChart({ data, height = 160, unit = '' }: Props) {
  const colors = useTheme();
  const W = 320;
  const H = height;
  const padTop = 14;
  const padBottom = 22;
  const plotH = H - padTop - padBottom;

  if (data.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mute, fontSize: 13 }}>Aucune donnée</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = W / data.length;
  const barW = Math.min(slot * 0.55, 34);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const cx = i * slot + slot / 2;
          return (
            <Rect
              key={i}
              x={cx - barW / 2}
              y={padTop + plotH - h}
              width={barW}
              height={Math.max(h, 2)}
              rx={5}
              fill={d.highlight ? colors.accent : colors.surface3 ?? colors.surface2}
              opacity={d.highlight ? 1 : 0.85}
            />
          );
        })}
      </Svg>

      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 9,
                color: d.highlight ? colors.accent : colors.mute,
                fontWeight: d.highlight ? '700' : '400',
              }}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
