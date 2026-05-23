import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

export interface LinePoint {
  label: string;   // x-axis label (e.g. "12 mai")
  value: number;
}

interface Props {
  data: LinePoint[];
  height?: number;
  unit?: string;
}

/**
 * Lightweight responsive line chart (react-native-svg).
 * Auto-scales Y to data min/max with padding, draws an area fill.
 */
export function LineChart({ data, height = 160, unit = '' }: Props) {
  const colors = useTheme();
  const W = 320;       // viewBox width (scales to container)
  const H = height;
  const padX = 8;
  const padTop = 16;
  const padBottom = 22;

  if (data.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mute, fontSize: 13 }}>
          Pas assez de données pour tracer une courbe
        </Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padded = range * 0.15;
  const yMin = min - padded;
  const yMax = max + padded;

  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const x = (i: number) => padX + (i / (data.length - 1)) * plotW;
  const y = (v: number) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const last = data[data.length - 1];
  const first = data[0];
  const delta = last.value - first.value;

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="lcArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* horizontal grid lines */}
        {[0, 0.5, 1].map((t) => (
          <Line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padTop + plotH * t}
            y2={padTop + plotH * t}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}

        <Path d={areaPath} fill="url(#lcArea)" />
        <Path d={linePath} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" />

        {data.map((d, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(d.value)}
            r={i === data.length - 1 ? 4 : 2.5}
            fill={i === data.length - 1 ? colors.accent : colors.bg}
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {/* x labels: first / middle / last */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 }}>
        <Text style={{ fontSize: 10, color: colors.mute }}>{first.label}</Text>
        <Text style={{ fontSize: 10, color: colors.mute }}>
          {data[Math.floor(data.length / 2)].label}
        </Text>
        <Text style={{ fontSize: 10, color: colors.mute }}>{last.label}</Text>
      </View>

      {/* summary */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
          {last.value}{unit}
        </Text>
        <Text
          style={{
            fontSize: 13, fontWeight: '700',
            color: delta > 0 ? colors.success : delta < 0 ? colors.danger : colors.mute,
          }}
        >
          {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10}{unit}
        </Text>
      </View>
    </View>
  );
}
