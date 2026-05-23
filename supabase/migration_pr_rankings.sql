-- ============================================================
-- SALLE — Migration : classements de records par exercice
-- Permet la LECTURE publique des records (comme XP/streak via
-- profiles_read_all) tout en gardant l'écriture réservée au
-- propriétaire. À exécuter une fois dans l'éditeur SQL Supabase.
-- ============================================================

-- Lecture publique des records (pour les classements inter-utilisateurs)
drop policy if exists "personal_records_read_all" on public.personal_records;
create policy "personal_records_read_all"
  on public.personal_records for select using (true);

-- (Les politiques d'écriture restent : personal_records_own couvre
--  INSERT / UPDATE / DELETE avec auth.uid() = user_id.)
