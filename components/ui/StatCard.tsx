import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accentValue?: boolean;
}

export function StatCard({ label, value, unit, hint, accentValue = false }: Props) {
  const colors = useTheme();
  return (
    <Card style={{ alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: accentValue ? colors.accent : colors.text, letterSpacing: -0.5 }}>
          {value}
        </Text>
        {unit && <Text style={{ fontSize: 13, color: colors.mute }}>{unit}</Text>}
      </View>
      {hint && <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4 }}>{hint}</Text>}
    </Card>
  );
}
