export type Palette = 'volt' | 'pulse' | 'mono';

const volt = {
  bg: '#0A0A0B',
  surface: '#131316',
  surface2: '#1B1B1F',
  surface3: '#25252B',
  border: '#26262B',
  border2: '#34343C',
  text: '#F5F5F7',
  text2: '#B9B9C2',
  mute: '#6F6F79',
  accent: '#C7FF3D',
  accentInk: '#0A0A0B',
  accent2: '#5C7CFF',
  success: '#4ADE80',
  danger: '#FF5468',
  warn: '#FFB13D',
};

const pulse = {
  bg: '#07090F',
  surface: '#10141E',
  surface2: '#1A1F2D',
  surface3: '#242B3D',
  border: '#232838',
  border2: '#313853',
  text: '#F0F4FF',
  text2: '#AEB7D0',
  mute: '#6A7592',
  accent: '#FF4D8F',
  accentInk: '#FFFFFF',
  accent2: '#00E0FF',
  success: '#4ADE80',
  danger: '#FF5468',
  warn: '#FFB13D',
};

const mono = {
  bg: '#0B0B0E',
  surface: '#15151A',
  surface2: '#1E1E25',
  surface3: '#292932',
  border: '#25252E',
  border2: '#34343F',
  text: '#ECECF0',
  text2: '#ADADB6',
  mute: '#6E6E78',
  accent: '#8B5CF6',
  accentInk: '#FFFFFF',
  accent2: '#FF7849',
  success: '#4ADE80',
  danger: '#FF5468',
  warn: '#FFB13D',
};

export const palettes = { volt, pulse, mono };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const fontSizes = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 32,
};
