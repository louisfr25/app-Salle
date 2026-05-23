/**
 * Service photos de séance — upload, signed URL, suppression.
 *
 * ⚠️ IMPORTANT — React Native + Supabase Storage :
 *    fetch(localUri).blob() retourne un blob vide/corrompu dans React Native.
 *    On utilise FileSystem.readAsStringAsync (base64) → Uint8Array à la place.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export interface WorkoutPhoto {
  id: string;
  user_id: string;
  workout_log_id: string | null;
  storage_path: string;
  created_at: string;
  signedUrl?: string;
}

const BUCKET = 'workout-photos';
const SIGNED_URL_TTL = 60 * 60; // 1 heure

/** Décodes a base64 string to Uint8Array (atob disponible dès RN 0.71 / Expo SDK 50+). */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Détecte l'extension et le MIME type depuis une URI locale. */
function extractMeta(localUri: string): { ext: string; mime: string } {
  // Ignorer les query params éventuels
  const clean = localUri.split('?')[0];
  const raw   = clean.split('.').pop()?.toLowerCase().replace(/[^a-z]/g, '') ?? 'jpg';
  const ext   = raw === 'jpeg' ? 'jpg' : (raw || 'jpg');
  const mime  = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return { ext, mime };
}

// ─────────────────────────────────────────────────────────────────────────────

/** Upload une image (URI locale) et insère la ligne en BDD. */
export async function uploadWorkoutPhoto(
  userId: string,
  workoutLogId: string | null,
  localUri: string,
): Promise<WorkoutPhoto | null> {
  try {
    const { ext, mime } = extractMeta(localUri);
    const path = `${userId}/${Date.now()}.${ext}`;

    // 1. Lire le fichier en base64 via FileSystem (fiable dans Expo Go)
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length < 100) {
      throw new Error(`Fichier vide ou illisible (base64 length=${base64?.length})`);
    }

    // 2. Convertir base64 → Uint8Array pour Supabase Storage
    const bytes = base64ToBytes(base64);

    // 3. Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 4. Insérer la ligne en BDD
    const { data, error: dbError } = await supabase
      .from('workout_photos')
      .insert({ user_id: userId, workout_log_id: workoutLogId, storage_path: path })
      .select()
      .single();

    if (dbError) throw dbError;
    return data as WorkoutPhoto;

  } catch (e) {
    if (__DEV__) console.error('[uploadWorkoutPhoto]', e);
    return null;
  }
}

/** Récupère toutes les photos d'un utilisateur avec leurs signed URLs. */
export async function loadAllPhotos(userId: string): Promise<WorkoutPhoto[]> {
  const { data, error } = await supabase
    .from('workout_photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (__DEV__) console.error('[loadAllPhotos] DB error:', error);
    return [];
  }
  if (!data || data.length === 0) return [];

  // Génère les signed URLs en batch
  const paths = (data as WorkoutPhoto[]).map((p) => p.storage_path);
  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  if (__DEV__ && signedError) {
    console.error('[loadAllPhotos] createSignedUrls error:', signedError);
  }
  if (__DEV__) {
    console.log('[loadAllPhotos] signed URLs result:',
      signed?.map((s) => ({ path: s.path, ok: !!s.signedUrl, error: (s as any).error }))
    );
  }

  const urlMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (data as WorkoutPhoto[]).map((p) => ({
    ...p,
    signedUrl: urlMap.get(p.storage_path) ?? undefined,
  }));
}

/** Photos attachées à une séance spécifique. */
export async function loadPhotosForWorkout(workoutLogId: string): Promise<WorkoutPhoto[]> {
  const { data, error } = await supabase
    .from('workout_photos')
    .select('*')
    .eq('workout_log_id', workoutLogId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const paths = (data as WorkoutPhoto[]).map((p) => p.storage_path);
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  const urlMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (data as WorkoutPhoto[]).map((p) => ({
    ...p,
    signedUrl: urlMap.get(p.storage_path) ?? undefined,
  }));
}

/** Supprime une photo (Storage + BDD). */
export async function deleteWorkoutPhoto(photo: WorkoutPhoto): Promise<boolean> {
  try {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    await supabase.from('workout_photos').delete().eq('id', photo.id);
    return true;
  } catch (e) {
    if (__DEV__) console.error('[deleteWorkoutPhoto]', e);
    return false;
  }
}

/** Génère une signed URL fraîche pour une photo. */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}
