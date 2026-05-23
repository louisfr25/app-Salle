// ============================================================
// LOCAL NOTIFICATIONS — rest timer + streak / hydration reminders
// expo-notifications is lazily imported so a degraded Expo Go
// environment can never block app startup.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY_ENABLED = 'notif_enabled';
const KEY_STREAK_ID = 'notif_streak_id';
const KEY_HYDRATION_ID = 'notif_hydration_id';

let handlerSet = false;

// Lazy module getter — returns null if unavailable (Expo Go limitations).
async function getN(): Promise<any | null> {
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

// ── One-time setup (call at app start) ───────────────────────
export async function configureNotifications(): Promise<void> {
  if (handlerSet) return;
  handlerSet = true;
  try {
    const N = await getN();
    if (!N) return;
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Salle',
        importance: N.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C7FF3D',
      });
    }
  } catch {
    /* ignore — notifications optional */
  }
}

// ── Permissions ──────────────────────────────────────────────
export async function requestPermissions(): Promise<boolean> {
  try {
    const N = await getN();
    if (!N) return false;
    const { status: existing } = await N.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await N.requestPermissionsAsync();
      status = req.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function hasPermission(): Promise<boolean> {
  try {
    const N = await getN();
    if (!N) return false;
    const { status } = await N.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Enabled preference (persisted) ───────────────────────────
export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_ENABLED);
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_ENABLED, enabled ? '1' : '0');
    if (enabled) {
      await requestPermissions();
      await scheduleStreakReminder();
      await scheduleHydrationReminder();
    } else {
      await cancelAllReminders();
    }
  } catch {
    /* ignore */
  }
}

// ── Rest timer ───────────────────────────────────────────────
export async function scheduleRestEnd(seconds: number): Promise<string | null> {
  try {
    if (seconds < 3) return null;
    if (!(await getNotificationsEnabled())) return null;
    const N = await getN();
    if (!N) return null;
    return await N.scheduleNotificationAsync({
      content: {
        title: '💪 Repos terminé',
        body: "C'est reparti — passe à ta prochaine série !",
        sound: true,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    const N = await getN();
    if (!N) return;
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}

// ── Daily streak reminder (19:00) ────────────────────────────
export async function scheduleStreakReminder(): Promise<void> {
  try {
    if (!(await getNotificationsEnabled())) return;
    const N = await getN();
    if (!N) return;
    const prev = await AsyncStorage.getItem(KEY_STREAK_ID);
    await cancelNotification(prev);

    const id = await N.scheduleNotificationAsync({
      content: {
        title: '🔥 Ne casse pas ta série !',
        body: "Tu n'as pas encore entraîné aujourd'hui. Une petite séance ?",
        sound: false,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: 19,
        minute: 0,
      },
    });
    await AsyncStorage.setItem(KEY_STREAK_ID, id);
  } catch {
    /* ignore */
  }
}

// ── Daily hydration reminder (14:00) ─────────────────────────
export async function scheduleHydrationReminder(): Promise<void> {
  try {
    if (!(await getNotificationsEnabled())) return;
    const N = await getN();
    if (!N) return;
    const prev = await AsyncStorage.getItem(KEY_HYDRATION_ID);
    await cancelNotification(prev);

    const id = await N.scheduleNotificationAsync({
      content: {
        title: '💧 Hydratation',
        body: "Pense à boire de l'eau et à logger ta journée.",
        sound: false,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: 14,
        minute: 0,
      },
    });
    await AsyncStorage.setItem(KEY_HYDRATION_ID, id);
  } catch {
    /* ignore */
  }
}

// ── One-off immediate notification ───────────────────────────
export async function notifyNow(title: string, body: string): Promise<void> {
  try {
    if (!(await getNotificationsEnabled())) return;
    const N = await getN();
    if (!N) return;
    await N.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    const N = await getN();
    if (N) await N.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.multiRemove([KEY_STREAK_ID, KEY_HYDRATION_ID]);
  } catch {
    /* ignore */
  }
}

// Count scheduled notifications (for the settings screen).
export async function scheduledCount(): Promise<number> {
  try {
    const N = await getN();
    if (!N) return 0;
    const list = await N.getAllScheduledNotificationsAsync();
    return list?.length ?? 0;
  } catch {
    return 0;
  }
}

// Re-arm the recurring daily reminders (call on app start).
export async function initDailyReminders(): Promise<void> {
  try {
    if (!(await getNotificationsEnabled())) return;
    if (!(await hasPermission())) return;
    await scheduleStreakReminder();
    await scheduleHydrationReminder();
  } catch {
    /* ignore */
  }
}
