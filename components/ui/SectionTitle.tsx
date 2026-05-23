import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({ title, sub, action, onAction }: Props) {
  const colors = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
        {sub && <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{sub}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
