-- Révise — schéma complet à exécuter dans Supabase (SQL Editor).
-- Réinitialise puis recrée tout proprement : peut être exécuté plusieurs
-- fois sans erreur, quel que soit l'état de départ.

-- 0. Reset ------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists "lesson_photos_select_own" on storage.objects;
drop policy if exists "lesson_photos_insert_own" on storage.objects;
drop policy if exists "lesson_photos_delete_own" on storage.objects;

drop table if exists public.quiz_sets cascade;
drop table if exists public.lessons cascade;
drop table if exists public.subjects cascade;
drop table if exists public.profiles cascade;

-- 1. Profils (classe, langues, XP, streak) ------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  grade text,
  lv1 text,
  lv2 text,
  xp integer not null default 0,
  streak integer not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Matières -------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "subjects_all_own" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Leçons -----------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  extracted_text text not null default '',
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

create policy "lessons_all_own" on public.lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Matériel de révision (QCM, flashcards, notions, exercices) -----------

create table public.quiz_sets (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  qcm jsonb not null default '[]',
  flashcards jsonb not null default '[]',
  lesson_cards jsonb not null default '[]',
  exercises jsonb not null default '[]',
  generated_at timestamptz not null default now()
);

alter table public.quiz_sets enable row level security;

create policy "quiz_sets_all_own" on public.quiz_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Stockage des photos de leçons ------------------------------------------

insert into storage.buckets (id, name, public)
values ('lesson-photos', 'lesson-photos', false)
on conflict (id) do nothing;

create policy "lesson_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
