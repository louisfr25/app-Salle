import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  accent?: boolean;
  style?: ViewStyle;
}

export function Chip({ label, accent = false, style }: Props) {
  const colors = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: accent ? `${colors.accent}28` : colors.surface2,
          borderWidth: 1,
          borderColor: accent ? `${colors.accent}4D` : colors.border,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: accent ? colors.accent : colors.text2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
