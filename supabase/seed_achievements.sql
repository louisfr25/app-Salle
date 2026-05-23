-- ============================================================
-- SALLE — Achievement definitions seed
-- Run once in the Supabase SQL editor.
-- Idempotent: on conflict (code) it updates the row.
-- ============================================================
insert into public.achievements (code, name, description, icon, xp_reward, rarity) values
  ('first_workout',    'Premier pas',          'Termine ta toute première séance.',                 '🎯', 50,  'common'),
  ('workouts_10',      'Régulier',             'Termine 10 séances.',                               '💪', 100, 'common'),
  ('workouts_25',      'Assidu',               'Termine 25 séances.',                               '🔩', 150, 'rare'),
  ('workouts_50',      'Machine',              'Termine 50 séances.',                               '⚙️', 250, 'rare'),
  ('workouts_100',     'Légende',              'Termine 100 séances.',                              '👑', 500, 'epic'),
  ('streak_3',         'En rythme',            'Enchaîne 3 jours d''entraînement.',                 '🔥', 50,  'common'),
  ('streak_7',         'Une semaine de feu',   'Enchaîne 7 jours d''entraînement.',                 '🔥', 150, 'rare'),
  ('streak_14',        'Inflexible',           'Enchaîne 14 jours d''entraînement.',                '⚡', 300, 'epic'),
  ('streak_30',        'Inarrêtable',          'Enchaîne 30 jours d''entraînement.',                '🏆', 750, 'legendary'),
  ('first_pr',         'Premier record',       'Établis ton premier record personnel.',             '🥇', 75,  'common'),
  ('pr_10',            'Briseur de records',   'Établis 10 records personnels.',                    '📈', 200, 'rare'),
  ('pr_25',            'Surhumain',            'Établis 25 records personnels.',                    '🚀', 400, 'epic'),
  ('volume_5k',        'Tonne soulevée',       'Soulève 5 000 kg cumulés.',                         '🪨', 100, 'common'),
  ('volume_25k',       'Force brute',          'Soulève 25 000 kg cumulés.',                        '🦾', 250, 'rare'),
  ('volume_100k',      'Titan',                'Soulève 100 000 kg cumulés.',                       '🗿', 600, 'legendary'),
  ('early_bird',       'Lève-tôt',             'Commence une séance avant 6h du matin.',            '🌅', 100, 'rare'),
  ('night_owl',        'Oiseau de nuit',       'Commence une séance après 22h.',                    '🌙', 100, 'rare'),
  ('weekend_warrior',  'Guerrier du week-end', 'Entraîne-toi un samedi ou un dimanche.',            '⚔️', 75,  'common'),
  ('complete_profile', 'Profil complet',       'Renseigne nom, poids, taille et objectif.',         '✅', 50,  'common')
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  xp_reward   = excluded.xp_reward,
  rarity      = excluded.rarity;
