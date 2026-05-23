-- ============================================================
-- SALLE — Seed data (test / dev)
-- ============================================================

-- Exercise library (matches constants/exercises.ts)
insert into public.exercises (id, name, muscle_group, muscles, equipment, default_sets, default_reps, default_rest) values
  ('00000000-0000-0000-0000-000000000001', 'Développé couché',      'Pectoraux', ARRAY['Pectoral moyen','Triceps','Deltoïde antérieur'],    ARRAY['Barre'],             4, 8,  120),
  ('00000000-0000-0000-0000-000000000002', 'Développé incliné',     'Pectoraux', ARRAY['Pectoral supérieur','Triceps'],                      ARRAY['Haltères','Barre'],  3, 10, 90),
  ('00000000-0000-0000-0000-000000000003', 'Dips',                  'Pectoraux', ARRAY['Pectoral inférieur','Triceps'],                      ARRAY['Poids du corps'],    3, 12, 90),
  ('00000000-0000-0000-0000-000000000004', 'Écarté câbles',         'Pectoraux', ARRAY['Pectoral moyen'],                                    ARRAY['Câbles'],            3, 15, 60),
  ('00000000-0000-0000-0000-000000000005', 'Pompes',                'Pectoraux', ARRAY['Pectoraux','Triceps'],                               ARRAY['Poids du corps'],    3, 15, 60),
  ('00000000-0000-0000-0000-000000000006', 'Tractions',             'Dos',       ARRAY['Grand dorsal','Biceps'],                             ARRAY['Poids du corps'],    4, 8,  120),
  ('00000000-0000-0000-0000-000000000007', 'Rowing barre',          'Dos',       ARRAY['Grand dorsal','Rhomboïdes','Biceps'],                ARRAY['Barre'],             4, 8,  120),
  ('00000000-0000-0000-0000-000000000008', 'Tirage vertical',       'Dos',       ARRAY['Grand dorsal'],                                      ARRAY['Machine','Câbles'],  3, 12, 90),
  ('00000000-0000-0000-0000-000000000009', 'Rowing assis',          'Dos',       ARRAY['Grand dorsal','Rhomboïdes'],                         ARRAY['Câbles','Machine'],  3, 12, 90),
  ('00000000-0000-0000-0000-000000000010', 'Soulevé de terre',      'Dos',       ARRAY['Lombaires','Fessiers','Ischio-jambiers'],            ARRAY['Barre'],             4, 5,  180),
  ('00000000-0000-0000-0000-000000000011', 'Développé militaire',   'Épaules',   ARRAY['Deltoïde antérieur','Deltoïde latéral','Triceps'],   ARRAY['Barre','Haltères'],  4, 8,  120),
  ('00000000-0000-0000-0000-000000000012', 'Élévations latérales',  'Épaules',   ARRAY['Deltoïde latéral'],                                  ARRAY['Haltères','Câbles'], 3, 15, 60),
  ('00000000-0000-0000-0000-000000000013', 'Face pull',             'Épaules',   ARRAY['Deltoïde postérieur','Trapèzes'],                    ARRAY['Câbles'],            3, 15, 60),
  ('00000000-0000-0000-0000-000000000014', 'Curl biceps',           'Bras',      ARRAY['Biceps'],                                            ARRAY['Haltères','Barre'],  3, 12, 60),
  ('00000000-0000-0000-0000-000000000015', 'Curl marteau',          'Bras',      ARRAY['Biceps','Avant-bras'],                               ARRAY['Haltères'],          3, 12, 60),
  ('00000000-0000-0000-0000-000000000016', 'Extension triceps câbles','Bras',    ARRAY['Triceps'],                                           ARRAY['Câbles'],            3, 15, 60),
  ('00000000-0000-0000-0000-000000000017', 'Skull crushers',        'Bras',      ARRAY['Triceps'],                                           ARRAY['Barre','Haltères'],  3, 12, 60),
  ('00000000-0000-0000-0000-000000000018', 'Gainage',               'Abdos',     ARRAY['Abdo. supérieur','Obliques'],                        ARRAY['Poids du corps'],    3, 60, 60),
  ('00000000-0000-0000-0000-000000000019', 'Crunchs',               'Abdos',     ARRAY['Abdo. supérieur'],                                   ARRAY['Poids du corps'],    3, 20, 45),
  ('00000000-0000-0000-0000-000000000020', 'Relevés de jambes',     'Abdos',     ARRAY['Abdo. inférieur'],                                   ARRAY['Poids du corps'],    3, 15, 60),
  ('00000000-0000-0000-0000-000000000021', 'Squat',                 'Jambes',    ARRAY['Quadriceps','Fessiers','Ischio-jambiers'],           ARRAY['Barre'],             4, 8,  180),
  ('00000000-0000-0000-0000-000000000022', 'Presse à cuisses',      'Jambes',    ARRAY['Quadriceps','Fessiers'],                             ARRAY['Machine'],           4, 10, 120),
  ('00000000-0000-0000-0000-000000000023', 'Fentes',                'Jambes',    ARRAY['Quadriceps','Fessiers'],                             ARRAY['Haltères','Poids du corps'], 3, 12, 90),
  ('00000000-0000-0000-0000-000000000024', 'Soulevé roumain',       'Jambes',    ARRAY['Ischio-jambiers','Fessiers'],                        ARRAY['Barre','Haltères'],  3, 10, 90),
  ('00000000-0000-0000-0000-000000000025', 'Hip thrust',            'Jambes',    ARRAY['Fessiers'],                                          ARRAY['Barre'],             4, 12, 90),
  ('00000000-0000-0000-0000-000000000026', 'Mollets debout',        'Jambes',    ARRAY['Mollets'],                                           ARRAY['Machine','Haltères'],4, 15, 60)
on conflict do nothing;

-- Achievements
insert into public.achievements (code, name, description, icon, xp_reward, rarity) values
  ('first_workout',   'Première séance',        'Complète ta première séance',                  '🎯', 100, 'common'),
  ('streak_3',        'En feu',                 '3 jours d''affilée',                           '🔥', 150, 'common'),
  ('streak_7',        'Semaine parfaite',        '7 jours consécutifs',                          '⚡', 300, 'rare'),
  ('streak_30',       'Invincible',              '30 jours consécutifs',                         '💎', 1000, 'legendary'),
  ('pr_bench',        'King du bench',           'Nouveau record au développé couché',           '🏋️', 200, 'rare'),
  ('pr_squat',        'Legs Day Champion',       'Nouveau record au squat',                      '🦵', 200, 'rare'),
  ('pr_deadlift',     'Seigneur du sol',         'Nouveau record au soulevé de terre',           '⚔️', 200, 'rare'),
  ('10_workouts',     'Régulier',                '10 séances complétées',                        '📅', 200, 'common'),
  ('50_workouts',     'Acharné',                 '50 séances complétées',                        '💪', 500, 'rare'),
  ('100_workouts',    'Légende',                 '100 séances complétées',                       '🏆', 2000, 'legendary'),
  ('100kg_bench',     'Club des 100',            '100 kg au développé couché',                   '💯', 500, 'epic'),
  ('bodyweight_squat','Poids du corps au squat', 'Squatter son propre poids',                    '🎖️', 300, 'rare'),
  ('first_program',   'Architecte',              'Créé ton premier programme',                   '📋', 100, 'common'),
  ('balanced_week',   'Équilibre parfait',       'Tous les groupes musculaires touchés en 1 semaine', '⚖️', 250, 'rare')
on conflict (code) do nothing;
