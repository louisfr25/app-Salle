-- ============================================================
-- Migration : photos de séances (bucket privé + table + RLS)
-- À exécuter dans l'éditeur SQL Supabase (une seule fois)
-- ============================================================

-- 1. Table workout_photos
create table if not exists public.workout_photos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  workout_log_id  uuid references public.workout_logs(id) on delete set null,
  storage_path    text not null,           -- ex: "{user_id}/{timestamp}.jpg"
  created_at      timestamptz default now()
);

-- Index pour la galerie (chronologique par utilisateur)
create index if not exists workout_photos_user_created
  on public.workout_photos (user_id, created_at desc);

-- Index pour les photos d'une séance
create index if not exists workout_photos_workout_log
  on public.workout_photos (workout_log_id);

-- 2. RLS — chaque utilisateur ne voit que ses propres photos
alter table public.workout_photos enable row level security;

create policy "photos_select_own"
  on public.workout_photos for select
  using (auth.uid() = user_id);

create policy "photos_insert_own"
  on public.workout_photos for insert
  with check (auth.uid() = user_id);

create policy "photos_delete_own"
  on public.workout_photos for delete
  using (auth.uid() = user_id);

-- 3. Bucket de stockage privé "workout-photos"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-photos',
  'workout-photos',
  false,                    -- PRIVÉ : accès uniquement via signed URL
  5242880,                  -- 5 Mo max par photo
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 4. Politiques Storage — accès restreint au propriétaire
create policy "wp_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'workout-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "wp_select_own"
  on storage.objects for select
  using (
    bucket_id = 'workout-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "wp_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'workout-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
