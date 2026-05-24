/**
 * healthService.ts
 * Synchronisation des données de santé via expo-sensors (Pedometer)
 * → lit les données HealthKit (iOS) / Google Fit / Step Counter (Android)
 *
 * Données disponibles :
 *   - Pas réels (source exacte HealthKit / Step Counter)
 *   - Distance estimée (depuis la foulée moyenne)
 *   - Minutes cardio estimées (seuil de marche active)
 *   - Calories actives estimées (formule MET — affichage uniquement)
 */

import { Pedometer } from 'expo-sensors';
type PedometerResult = { steps: number };

// ── Types ─────────────────────────────────────────────────────────────────────

export type HealthSource = 'healthkit' | 'pedometer' | 'unavailable';

export interface HealthSnapshot {
  /** Nombre de pas exact lu depuis le capteur / HealthKit */
  steps: number | null;
  /** Distance en mètres (estimée depuis la foulée) */
  distance_m: number | null;
  /** Minutes cardio estimées (marche active : > 60 pas/min équiv.) */
  cardioMinutes: number | null;
  /** Calories actives brûlées estimées — pour affichage uniquement */
  activeKcal: number | null;
  /** Origine de la donnée */
  source: HealthSource;
  /** Horodatage ISO de la dernière synchro */
  syncedAt: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

// Pas "de base" quotidiens (déplacements normaux) exclus du calcul cardio
const SEDENTARY_STEPS = 3_000;
// Pas par minute lors d'une marche cardio soutenue
const STEPS_PER_CARDIO_MINUTE = 100;
// Longueur de foulée moyenne (en mètres) — utilisée si height_cm absent
const DEFAULT_STRIDE_M = 0.762;
// Calorie brûlée par pas pour une personne de 70 kg (met × poids / 1000)
const KCAL_PER_STEP_70KG = 0.04;

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Estime les calories actives brûlées à partir des pas et du poids.
 * Formule : pas × (poids_kg / 70) × KCAL_PER_STEP_70KG
 */
function estimateKcal(steps: number, weightKg?: number | null): number {
  const factor = weightKg ? weightKg / 70 : 1;
  return Math.round(steps * KCAL_PER_STEP_70KG * factor);
}

/**
 * Estime les minutes de cardio actif à partir des pas.
 * On soustrait les pas "sédentaires", puis on divise par cadence cardio.
 */
function estimateCardioMinutes(steps: number): number {
  const activeSteps = Math.max(0, steps - SEDENTARY_STEPS);
  return Math.min(180, Math.round(activeSteps / STEPS_PER_CARDIO_MINUTE));
}

/**
 * Estime la distance en mètres (foulée moyenne × pas).
 */
function estimateDistance(steps: number, heightCm?: number | null): number {
  const stride = heightCm ? heightCm * 0.00414 : DEFAULT_STRIDE_M;
  return Math.round(steps * stride);
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Récupère un snapshot des données de santé pour aujourd'hui.
 * @param weightKg  Poids de l'utilisateur (pour calculer les calories).
 * @param heightCm  Taille (pour affiner la longueur de foulée).
 */
export async function getTodayHealthSnapshot(
  weightKg?: number | null,
  heightCm?: number | null,
): Promise<HealthSnapshot> {
  const unavailable: HealthSnapshot = {
    steps: null,
    distance_m: null,
    cardioMinutes: null,
    activeKcal: null,
    source: 'unavailable',
    syncedAt: new Date().toISOString(),
  };

  try {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) return unavailable;

    const start = startOfToday();
    const end   = new Date();
    const result: PedometerResult = await Pedometer.getStepCountAsync(start, end);

    if (!result?.steps) return unavailable;

    const steps = result.steps;

    // iOS lit depuis HealthKit, Android depuis le capteur de pas
    const source: HealthSource = 'pedometer';

    return {
      steps,
      distance_m:    estimateDistance(steps, heightCm),
      cardioMinutes: estimateCardioMinutes(steps),
      activeKcal:    estimateKcal(steps, weightKg),
      source,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return unavailable;
  }
}

/**
 * Vérifie si le podomètre est disponible sur cet appareil.
 */
export async function isHealthAvailable(): Promise<boolean> {
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Formate une distance en mètres en texte lisible (m ou km).
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}
