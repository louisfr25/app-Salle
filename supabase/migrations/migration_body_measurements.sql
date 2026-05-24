-- ──────────────────────────────────────────────────────────────────────────────
-- Mesures corporelles (tour de taille, poitrine, bras, etc.)
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS body_measurements (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  measured_at   DATE         NOT NULL DEFAULT CURRENT_DATE,
  -- Mensurations en centimètres
  chest_cm      FLOAT,      -- Poitrine
  waist_cm      FLOAT,      -- Tour de taille
  hips_cm       FLOAT,      -- Hanches
  left_arm_cm   FLOAT,      -- Bras gauche (biceps gonflé)
  right_arm_cm  FLOAT,      -- Bras droit
  left_thigh_cm FLOAT,      -- Cuisse gauche
  right_thigh_cm FLOAT,     -- Cuisse droite
  neck_cm        FLOAT,      -- Cou
  -- Composition corporelle
  body_fat_pct  FLOAT,      -- % masse grasse (optionnel)
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- Un seul enregistrement par jour et par utilisateur
  UNIQUE (user_id, measured_at)
);

-- RLS
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own measurements"
  ON body_measurements FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index pour accès rapide à l'historique
CREATE INDEX IF NOT EXISTS body_measurements_user_date
  ON body_measurements (user_id, measured_at DESC);
