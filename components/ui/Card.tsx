import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius } from '../../constants/theme';

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'elevated';
  padding?: number;
}

export function Card({ children, style, variant = 'default', padding = 16 }: Props) {
  const colors = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: variant === 'elevated' ? colors.surface2 : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
