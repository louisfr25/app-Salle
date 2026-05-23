import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  value: number; // 0–1
  height?: number;
  color?: string;
  style?: ViewStyle;
}

export function ProgressBar({ value, height = 6, color, style }: Props) {
  const colors = useTheme();
  return (
    <View
      style={[
        {
          width: '100%',
          height,
          borderRadius: 999,
          backgroundColor: colors.surface2,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          borderRadius: 999,
          backgroundColor: color ?? colors.accent,
        }}
      />
    </View>
  );
}
