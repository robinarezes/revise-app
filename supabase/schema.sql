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
  username text,
  grade text,
  lv1 text,
  lv2 text,
  xp integer not null default 0,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  streak_freezes integer not null default 1,
  last_active_date date,
  dyslexia_mode boolean not null default false,
  dyslexia_font text not null default 'system',
  dyslexia_tint text not null default 'cream',
  dyslexia_size text not null default 'medium',
  tts_voice text not null default 'alloy',
  subscription_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Colonnes d'abonnement en lecture seule pour le client : seul le webhook
-- Stripe (clé service_role, hors RLS) peut les modifier.
revoke update on public.profiles from authenticated;
grant update (
  username, grade, lv1, lv2, dyslexia_mode, dyslexia_font, dyslexia_tint, dyslexia_size,
  tts_voice, xp, streak, longest_streak, streak_freezes, last_active_date
) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant insert (id) on public.profiles to authenticated;

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

drop policy if exists "subjects_all_own" on public.subjects;
create policy "subjects_all_own" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Leçons -----------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  extracted_text text not null default '',
  simplified_text text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

drop policy if exists "lessons_all_own" on public.lessons;
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

drop policy if exists "quiz_sets_all_own" on public.quiz_sets;
create policy "quiz_sets_all_own" on public.quiz_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4bis. Résultats du quiz du jour (un par utilisateur/matière/jour) --------

create table public.daily_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  quiz_date date not null,
  score integer not null,
  total integer not null,
  xp_earned integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, subject, quiz_date)
);

alter table public.daily_quiz_results enable row level security;

drop policy if exists "daily_quiz_results_all_own" on public.daily_quiz_results;

create policy "daily_quiz_results_all_own" on public.daily_quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4ter. Codes premium, partageables entre plusieurs personnes --------------

create table public.premium_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz
);

alter table public.premium_codes enable row level security;

-- Aucune policy : accessible uniquement depuis le serveur (service_role).

create table public.premium_code_redemptions (
  code text not null references public.premium_codes(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.premium_code_redemptions enable row level security;

-- Aucune policy ici non plus : service_role uniquement.

-- 5. Stockage des photos de leçons ------------------------------------------

insert into storage.buckets (id, name, public)
values ('lesson-photos', 'lesson-photos', false)
on conflict (id) do nothing;

drop policy if exists "lesson_photos_select_own" on storage.objects;
create policy "lesson_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "lesson_photos_insert_own" on storage.objects;
create policy "lesson_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "lesson_photos_delete_own" on storage.objects;
create policy "lesson_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'lesson-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
