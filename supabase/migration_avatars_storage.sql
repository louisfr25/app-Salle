-- ============================================================
-- Migration : bucket "avatars" pour les photos de profil
-- À exécuter dans l'éditeur SQL Supabase (une seule fois)
-- ============================================================

-- 1. Créer le bucket public "avatars"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                          -- URLs publiques (lecture sans auth)
  2097152,                       -- 2 Mo max par fichier
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2. Politique : lecture publique (affichage avatar partout)
create policy "avatars_public_read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 3. Politique : upload uniquement dans son propre dossier {user_id}/
create policy "avatars_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Politique : mise à jour de son propre avatar
create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Politique : suppression de son propre avatar
create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
