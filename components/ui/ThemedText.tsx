import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { fontSizes } from '../../constants/theme';

interface Props {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[];
  variant?: 'body' | 'heading' | 'label' | 'mute' | 'mono' | 'display';
  size?: keyof typeof fontSizes;
  weight?: '400' | '500' | '600' | '700';
  color?: string;
  numberOfLines?: number;
}

export function ThemedText({
  children,
  style,
  variant = 'body',
  size,
  weight,
  color,
  numberOfLines,
}: Props) {
  const colors = useTheme();

  const textColor =
    color ??
    (variant === 'mute'
      ? colors.mute
      : variant === 'label'
      ? colors.text2
      : colors.text);

  const fontSize =
    size != null
      ? fontSizes[size]
      : variant === 'display'
      ? fontSizes.display
      : variant === 'heading'
      ? fontSizes.xl
      : variant === 'label' || variant === 'mute'
      ? fontSizes.sm
      : fontSizes.base;

  const fontWeight: TextStyle['fontWeight'] =
    weight ??
    (variant === 'display' || variant === 'heading'
      ? '700'
      : variant === 'label'
      ? '600'
      : '400');

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: textColor,
          fontSize,
          fontWeight,
          letterSpacing: variant === 'display' ? -0.5 : 0,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
