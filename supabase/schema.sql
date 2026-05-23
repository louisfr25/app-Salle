-- ============================================================
-- SALLE — Supabase / PostgreSQL Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text,
  avatar_url    text,
  bio           text,
  -- Body metrics
  height_cm     numeric(5,1),
  weight_kg     numeric(5,1),
  birth_date    date,
  gender        text check (gender in ('male','female','other')),
  -- Goals
  goal          text check (goal in ('muscle','strength','weight_loss','endurance','general')),
  level         text check (level in ('beginner','intermediate','advanced')) default 'beginner',
  -- Preferences
  palette       text default 'volt' check (palette in ('volt','pulse','mono')),
  units         text default 'metric' check (units in ('metric','imperial')),
  rest_seconds  int default 90,
  -- Gamification
  xp            int default 0,
  streak_days   int default 0,
  last_workout  date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- EXERCISE LIBRARY (global catalogue)
-- ────────────────────────────────────────────────────────────
create table public.exercises (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  muscle_group  text not null,
  muscles       text[] not null default '{}',
  equipment     text[] not null default '{}',
  default_sets  int default 3,
  default_reps  int default 10,
  default_rest  int default 90, -- seconds
  is_custom     boolean default false,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- PROGRAMS (workout plans)
-- ────────────────────────────────────────────────────────────
create table public.programs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  description   text,
  goal          text,
  level         text,
  days_per_week int not null default 3,
  source        text default 'manual' check (source in ('manual','ai')),
  is_active     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- PROGRAM SESSIONS (days within a program)
-- ────────────────────────────────────────────────────────────
create table public.program_sessions (
  id            uuid primary key default uuid_generate_v4(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  name          text not null,         -- ex: "Push A", "Jambes"
  day_index     int not null,          -- 0-based order within the week
  duration_min  int default 60,
  notes         text,
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- EXERCISES IN A PROGRAM SESSION
-- ────────────────────────────────────────────────────────────
create table public.session_exercises (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references public.program_sessions(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id),
  order_index   int not null default 0,
  sets          int not null default 3,
  reps          int not null default 10,
  rest_seconds  int default 90,
  notes         text
);

-- ────────────────────────────────────────────────────────────
-- WORKOUT LOGS (completed training sessions)
-- ────────────────────────────────────────────────────────────
create table public.workout_logs (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  program_session_id uuid references public.program_sessions(id),
  started_at        timestamptz not null,
  ended_at          timestamptz,
  duration_seconds  int,
  notes             text,
  rating            int check (rating between 1 and 5),
  xp_earned         int default 0,
  created_at        timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- SET LOGS (individual sets within a workout log)
-- ────────────────────────────────────────────────────────────
create table public.set_logs (
  id              uuid primary key default uuid_generate_v4(),
  workout_log_id  uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id),
  set_index       int not null,
  reps            int,
  weight_kg       numeric(6,2),
  duration_sec    int,           -- for timed exercises (plank, etc.)
  is_pr           boolean default false,
  rpe             int check (rpe between 1 and 10),
  completed_at    timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- DAILY LOGS (weight, nutrition, steps)
-- ────────────────────────────────────────────────────────────
create table public.daily_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  date            date not null,
  -- Body
  body_weight_kg  numeric(5,1),
  -- Nutrition
  calories        int,
  protein_g       numeric(6,1),
  carbs_g         numeric(6,1),
  fat_g           numeric(6,1),
  water_ml        int,
  -- Activity
  steps           int,
  cardio_minutes  int,
  -- Sleep
  sleep_hours     numeric(4,1),
  notes           text,
  created_at      timestamptz default now(),
  unique(user_id, date)
);

-- ────────────────────────────────────────────────────────────
-- ACHIEVEMENTS (badge definitions)
-- ────────────────────────────────────────────────────────────
create table public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,   -- ex: 'first_workout', 'streak_7'
  name        text not null,
  description text,
  icon        text,
  xp_reward   int default 50,
  rarity      text default 'common' check (rarity in ('common','rare','epic','legendary'))
);

-- ────────────────────────────────────────────────────────────
-- USER ACHIEVEMENTS
-- ────────────────────────────────────────────────────────────
create table public.user_achievements (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  achievement_id  uuid not null references public.achievements(id),
  earned_at       timestamptz default now(),
  unique(user_id, achievement_id)
);

-- ────────────────────────────────────────────────────────────
-- PERSONAL RECORDS
-- ────────────────────────────────────────────────────────────
create table public.personal_records (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id),
  weight_kg     numeric(6,2),
  reps          int,
  one_rm_kg     numeric(6,2),   -- estimated 1RM
  set_log_id    uuid references public.set_logs(id),
  achieved_at   timestamptz default now(),
  unique(user_id, exercise_id)
);

-- ────────────────────────────────────────────────────────────
-- MUSCLE VOLUME TRACKING (weekly aggregate)
-- ────────────────────────────────────────────────────────────
create table public.muscle_volume_weeks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  week_start  date not null,
  muscle_id   text not null,   -- matches SUB_MUSCLES[].id
  volume_pct  numeric(5,2) default 0,
  unique(user_id, week_start, muscle_id)
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
create index on public.workout_logs(user_id, started_at desc);
create index on public.set_logs(workout_log_id);
create index on public.set_logs(exercise_id, completed_at desc);
create index on public.daily_logs(user_id, date desc);
create index on public.personal_records(user_id, exercise_id);
create index on public.muscle_volume_weeks(user_id, week_start desc);

-- ────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.daily_logs enable row level security;
alter table public.user_achievements enable row level security;
alter table public.personal_records enable row level security;
alter table public.muscle_volume_weeks enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_read_all"  on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- All other tables: users can only access their own data
create policy "programs_own"           on public.programs           for all using (auth.uid() = user_id);
create policy "workout_logs_own"       on public.workout_logs       for all using (auth.uid() = user_id);
create policy "daily_logs_own"         on public.daily_logs         for all using (auth.uid() = user_id);
create policy "user_achievements_own"  on public.user_achievements  for all using (auth.uid() = user_id);
create policy "personal_records_own"   on public.personal_records   for all using (auth.uid() = user_id);
create policy "muscle_volume_own"      on public.muscle_volume_weeks for all using (auth.uid() = user_id);

-- program_sessions & session_exercises: via program ownership
create policy "program_sessions_own" on public.program_sessions for all
  using (program_id in (select id from public.programs where user_id = auth.uid()));

create policy "session_exercises_own" on public.session_exercises for all
  using (session_id in (
    select ps.id from public.program_sessions ps
    join public.programs p on p.id = ps.program_id
    where p.user_id = auth.uid()
  ));

-- set_logs: via workout_log ownership
create policy "set_logs_own" on public.set_logs for all
  using (workout_log_id in (select id from public.workout_logs where user_id = auth.uid()));

-- Exercises: global read, own custom exercises writable
create policy "exercises_read_all"   on public.exercises for select using (true);
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = created_by);
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = created_by);

-- Achievements: global read
alter table public.achievements enable row level security;
create policy "achievements_read_all" on public.achievements for select using (true);

-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_programs before update on public.programs
  for each row execute function public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
