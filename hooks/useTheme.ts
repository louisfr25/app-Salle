import { palettes } from '../constants/theme';
import { useAppStore } from '../lib/store/useAppStore';

export function useTheme() {
  const palette = useAppStore((s) => s.palette);
  return palettes[palette];
}
