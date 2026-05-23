-- ============================================================
-- SALLE — Migration de durcissement sécurité
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase.
-- Idempotent (drop if exists / create or replace).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. [HIGH] RLS manquante sur public.exercises
--    Sans RLS, les rôles anon/authenticated ont les GRANT par
--    défaut → n'importe qui pouvait INSERT/UPDATE/DELETE le
--    catalogue global d'exercices. On active la RLS : les
--    politiques existantes (lecture publique, écriture limitée
--    au créateur) deviennent réellement appliquées, et aucune
--    suppression n'est possible (pas de policy DELETE).
-- ────────────────────────────────────────────────────────────
alter table public.exercises enable row level security;

-- ────────────────────────────────────────────────────────────
-- 2. [HIGH] Sur-exposition des données personnelles des profils
--    `profiles_read_all USING (true)` exposait TOUTES les colonnes
--    (date de naissance, poids, taille, genre, bio…) de TOUS les
--    utilisateurs via l'API. On restreint la table aux lignes de
--    son propriétaire et on expose une VUE publique limitée aux
--    champs non sensibles (pour les classements / social).
-- ────────────────────────────────────────────────────────────
drop policy if exists "profiles_read_all" on public.profiles;

-- Lecture de SA PROPRE ligne uniquement (full table)
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Vue publique : uniquement les champs nécessaires au social.
-- (security_invoker laissé par défaut = false → la vue lit avec
--  les droits du propriétaire et n'expose QUE ces colonnes.)
drop view if exists public.public_profiles;
create view public.public_profiles as
  select id, username, avatar_url, xp, streak_days, level
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. [MEDIUM] Suppression de compte réelle (RGPD / droit à
--    l'effacement). Auparavant l'app se contentait d'un signOut.
--    Fonction SECURITY DEFINER : supprime le profil de l'appelant
--    (CASCADE sur toutes les tables liées) puis son compte auth.
-- ────────────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  -- Les FK ON DELETE CASCADE nettoient programs, logs, records, etc.
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
