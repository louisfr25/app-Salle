/**
 * Gestion du PIN de la galerie — stocké dans SecureStore (chiffré).
 * Le PIN est haché avec un simple SHA-256 avant stockage.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_PIN_HASH = 'gallery_pin_hash';
const KEY_PIN_SET  = 'gallery_pin_set';   // "1" si un PIN a été défini
const SESSION_TTL  = 5 * 60 * 1000;       // 5 min sans re-saisir le PIN

let _unlockedAt: number | null = null;

async function hash(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

/** Retourne true si un PIN a été défini */
export async function hasPIN(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY_PIN_SET);
    return v === '1';
  } catch { return false; }
}

/** Crée ou remplace le PIN */
export async function setPIN(pin: string): Promise<void> {
  const h = await hash(pin);
  await SecureStore.setItemAsync(KEY_PIN_HASH, h);
  await SecureStore.setItemAsync(KEY_PIN_SET, '1');
  _unlockedAt = Date.now();
}

/** Vérifie le PIN — retourne true si correct */
export async function verifyPIN(pin: string): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(KEY_PIN_HASH);
    if (!stored) return false;
    const h = await hash(pin);
    const ok = h === stored;
    if (ok) _unlockedAt = Date.now();
    return ok;
  } catch { return false; }
}

/** La session est-elle encore valide ? (5 min sans saisir le PIN) */
export function isUnlocked(): boolean {
  if (_unlockedAt == null) return false;
  return Date.now() - _unlockedAt < SESSION_TTL;
}

/** Force le verrouillage */
export function lock(): void {
  _unlockedAt = null;
}

/** Réinitialise le PIN (après email de reset) — supprime le hash */
export async function resetPIN(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN_HASH);
  await SecureStore.deleteItemAsync(KEY_PIN_SET);
  _unlockedAt = null;
}
