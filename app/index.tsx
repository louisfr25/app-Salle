import { Redirect } from 'expo-router';
import { useAppStore } from '../lib/store/useAppStore';

export default function Root() {
  const userId = useAppStore((s) => s.userId);
  return <Redirect href={userId ? '/(tabs)' : '/(auth)'} />;
}
