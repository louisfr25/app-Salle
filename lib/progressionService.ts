/**
 * progressionService.ts
 * Calcule la suggestion de progression (progressive overload) pour un exercice
 * basée sur les séries précédentes vs les cibles du programme.
 */

export type ProgressionType =
  | 'increase_weight'   // Augmente le poids
  | 'increase_reps'     // Augmente les répétitions (poids au corps)
  | 'maintain'          // Maintiens le poids/reps
  | 'first_time'        // Premier entraînement, pas de données
  | 'deload';           // Réduis le poids (surcharge ou forme insuffisante)

export interface ProgressionSuggestion {
  type: ProgressionType;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  message: string;
  emoji: string;
}

// Incrément de charge standard par niveau
const WEIGHT_INCREMENT: Record<string, number> = {
  legs:      5,    // Grands muscles → +5kg
  back:      2.5,
  chest:     2.5,
  shoulders: 2.5,
  arms:      1.25,
  default:   2.5,
};

/**
 * Calcule la suggestion de progression pour un exercice.
 *
 * @param previousSets   Dernières séries enregistrées pour cet exercice
 *                       (dans l'ordre d'exécution — le plus récent = la séance précédente)
 * @param targetReps     Nombre de reps cible défini dans le programme
 * @param targetSets     Nombre de séries cible
 * @param muscleGroup    Groupe musculaire (optionnel) pour calibrer l'incrément
 */
export function computeProgression(
  previousSets: Array<{ reps: number | null; weight_kg: number | null }>,
  targetReps: number,
  targetSets: number,
  muscleGroup?: string,
): ProgressionSuggestion {
  // Aucune donnée — premier entraînement
  if (!previousSets || previousSets.length === 0) {
    return {
      type: 'first_time',
      suggestedWeight: null,
      suggestedReps: targetReps,
      lastWeight: null,
      lastReps: null,
      message: 'Premier essai — commence à ton aise',
      emoji: '🆕',
    };
  }

  // Données de la séance précédente
  const validSets  = previousSets.filter((s) => s.reps != null);
  const lastWeight = previousSets[previousSets.length - 1]?.weight_kg ?? null;
  const lastReps   = previousSets[previousSets.length - 1]?.reps ?? null;
  const avgReps    = validSets.length > 0
    ? validSets.reduce((s, p) => s + (p.reps ?? 0), 0) / validSets.length
    : 0;

  const isBodyweight = !lastWeight || lastWeight === 0;
  const allSetsLogged = validSets.length >= Math.min(targetSets, previousSets.length);
  const allRepsHit    = validSets.every((s) => (s.reps ?? 0) >= targetReps);

  // ── Poids au corps ────────────────────────────────────────────────────────
  if (isBodyweight) {
    if (allSetsLogged && allRepsHit) {
      const newReps = targetReps + 2;
      return {
        type: 'increase_reps',
        suggestedWeight: null,
        suggestedReps: newReps,
        lastWeight: null,
        lastReps,
        message: `Vise ${newReps} reps (était ×${lastReps}) 💪`,
        emoji: '⬆',
      };
    }
    return {
      type: 'maintain',
      suggestedWeight: null,
      suggestedReps: targetReps,
      lastWeight: null,
      lastReps,
      message: `Maintiens ×${lastReps ?? targetReps} reps`,
      emoji: '🔁',
    };
  }

  // ── Avec charge ───────────────────────────────────────────────────────────
  const increment = WEIGHT_INCREMENT[muscleGroup?.toLowerCase() ?? 'default']
    ?? WEIGHT_INCREMENT.default;

  if (allSetsLogged && allRepsHit) {
    const newWeight = Math.round((lastWeight! + increment) * 4) / 4; // arrondi au 0.25
    return {
      type: 'increase_weight',
      suggestedWeight: newWeight,
      suggestedReps: targetReps,
      lastWeight,
      lastReps,
      message: `↑ Essaie ${newWeight} kg × ${targetReps} (était ${lastWeight} kg)`,
      emoji: '⬆',
    };
  }

  // Reps insuffisantes — maintenir le poids
  if (allSetsLogged && !allRepsHit && avgReps < targetReps * 0.8) {
    // Moins de 80% des reps atteintes → suggestion décharge légère
    const deloadWeight = Math.max(0, Math.round((lastWeight! - increment) * 4) / 4);
    return {
      type: 'deload',
      suggestedWeight: deloadWeight,
      suggestedReps: targetReps,
      lastWeight,
      lastReps,
      message: `Réduis à ${deloadWeight} kg × ${targetReps} pour bien maîtriser`,
      emoji: '↓',
    };
  }

  return {
    type: 'maintain',
    suggestedWeight: lastWeight,
    suggestedReps: targetReps,
    lastWeight,
    lastReps,
    message: `Maintiens ${lastWeight} kg × ${targetReps} reps`,
    emoji: '🔁',
  };
}
