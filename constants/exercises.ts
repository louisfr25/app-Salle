export type MuscleGroup =
  | 'Pectoraux'
  | 'Dos'
  | 'Épaules'
  | 'Bras'
  | 'Abdos'
  | 'Jambes'
  | 'Cardio';

export type Equipment =
  | 'Haltères'
  | 'Barre'
  | 'Machine'
  | 'Câbles'
  | 'Poids du corps'
  | 'Kettlebell';

export interface ExerciseTemplate {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  muscles: string[];
  equipment: Equipment[];
  defaultSets: number;
  defaultReps: number;
  defaultRest: number; // seconds
}

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  // Pectoraux
  { id: 'bench_press', name: 'Développé couché', muscleGroup: 'Pectoraux', muscles: ['Pectoral moyen', 'Triceps', 'Deltoïde antérieur'], equipment: ['Barre'], defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'incline_press', name: 'Développé incliné', muscleGroup: 'Pectoraux', muscles: ['Pectoral supérieur', 'Triceps'], equipment: ['Haltères', 'Barre'], defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'dips', name: 'Dips', muscleGroup: 'Pectoraux', muscles: ['Pectoral inférieur', 'Triceps'], equipment: ['Poids du corps'], defaultSets: 3, defaultReps: 12, defaultRest: 90 },
  { id: 'cable_fly', name: 'Écarté câbles', muscleGroup: 'Pectoraux', muscles: ['Pectoral moyen'], equipment: ['Câbles'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'pushup', name: 'Pompes', muscleGroup: 'Pectoraux', muscles: ['Pectoraux', 'Triceps'], equipment: ['Poids du corps'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },

  // Dos
  { id: 'pullup', name: 'Tractions', muscleGroup: 'Dos', muscles: ['Grand dorsal', 'Biceps'], equipment: ['Poids du corps'], defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'bent_row', name: 'Rowing barre', muscleGroup: 'Dos', muscles: ['Grand dorsal', 'Rhomboïdes', 'Biceps'], equipment: ['Barre'], defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'lat_pulldown', name: 'Tirage vertical', muscleGroup: 'Dos', muscles: ['Grand dorsal'], equipment: ['Machine', 'Câbles'], defaultSets: 3, defaultReps: 12, defaultRest: 90 },
  { id: 'seated_row', name: 'Rowing assis', muscleGroup: 'Dos', muscles: ['Grand dorsal', 'Rhomboïdes'], equipment: ['Câbles', 'Machine'], defaultSets: 3, defaultReps: 12, defaultRest: 90 },
  { id: 'deadlift', name: 'Soulevé de terre', muscleGroup: 'Dos', muscles: ['Lombaires', 'Fessiers', 'Ischio-jambiers'], equipment: ['Barre'], defaultSets: 4, defaultReps: 5, defaultRest: 180 },

  // Épaules
  { id: 'ohp', name: 'Développé militaire', muscleGroup: 'Épaules', muscles: ['Deltoïde antérieur', 'Deltoïde latéral', 'Triceps'], equipment: ['Barre', 'Haltères'], defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'lateral_raise', name: 'Élévations latérales', muscleGroup: 'Épaules', muscles: ['Deltoïde latéral'], equipment: ['Haltères', 'Câbles'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'face_pull', name: 'Face pull', muscleGroup: 'Épaules', muscles: ['Deltoïde postérieur', 'Trapèzes'], equipment: ['Câbles'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },

  // Bras
  { id: 'curl', name: 'Curl biceps', muscleGroup: 'Bras', muscles: ['Biceps'], equipment: ['Haltères', 'Barre'], defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'hammer_curl', name: 'Curl marteau', muscleGroup: 'Bras', muscles: ['Biceps', 'Avant-bras'], equipment: ['Haltères'], defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'tricep_pushdown', name: 'Extension triceps câbles', muscleGroup: 'Bras', muscles: ['Triceps'], equipment: ['Câbles'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'skull_crusher', name: 'Skull crushers', muscleGroup: 'Bras', muscles: ['Triceps'], equipment: ['Barre', 'Haltères'], defaultSets: 3, defaultReps: 12, defaultRest: 60 },

  // Abdos
  { id: 'plank', name: 'Gainage', muscleGroup: 'Abdos', muscles: ['Abdo. supérieur', 'Obliques'], equipment: ['Poids du corps'], defaultSets: 3, defaultReps: 60, defaultRest: 60 },
  { id: 'crunch', name: 'Crunchs', muscleGroup: 'Abdos', muscles: ['Abdo. supérieur'], equipment: ['Poids du corps'], defaultSets: 3, defaultReps: 20, defaultRest: 45 },
  { id: 'leg_raise', name: 'Relevés de jambes', muscleGroup: 'Abdos', muscles: ['Abdo. inférieur'], equipment: ['Poids du corps'], defaultSets: 3, defaultReps: 15, defaultRest: 60 },

  // Jambes
  { id: 'squat', name: 'Squat', muscleGroup: 'Jambes', muscles: ['Quadriceps', 'Fessiers', 'Ischio-jambiers'], equipment: ['Barre'], defaultSets: 4, defaultReps: 8, defaultRest: 180 },
  { id: 'leg_press', name: 'Presse à cuisses', muscleGroup: 'Jambes', muscles: ['Quadriceps', 'Fessiers'], equipment: ['Machine'], defaultSets: 4, defaultReps: 10, defaultRest: 120 },
  { id: 'lunges', name: 'Fentes', muscleGroup: 'Jambes', muscles: ['Quadriceps', 'Fessiers'], equipment: ['Haltères', 'Poids du corps'], defaultSets: 3, defaultReps: 12, defaultRest: 90 },
  { id: 'rdl', name: 'Soulevé roumain', muscleGroup: 'Jambes', muscles: ['Ischio-jambiers', 'Fessiers'], equipment: ['Barre', 'Haltères'], defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'hip_thrust', name: 'Hip thrust', muscleGroup: 'Jambes', muscles: ['Fessiers'], equipment: ['Barre'], defaultSets: 4, defaultReps: 12, defaultRest: 90 },
  { id: 'calf_raise', name: 'Mollets debout', muscleGroup: 'Jambes', muscles: ['Mollets'], equipment: ['Machine', 'Haltères'], defaultSets: 4, defaultReps: 15, defaultRest: 60 },
];
