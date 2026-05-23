import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  bg?: 'bg' | 'surface' | 'surface2' | 'surface3';
}

export function ThemedView({ children, style, bg = 'bg' }: Props) {
  const colors = useTheme();
  return (
    <View style={[{ backgroundColor: colors[bg] }, style]}>
      {children}
    </View>
  );
}
