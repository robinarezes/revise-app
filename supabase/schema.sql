-- Révise — schéma complet à exécuter dans Supabase (SQL Editor).
-- Réinitialise puis recrée tout proprement : peut être exécuté plusieurs
-- fois sans erreur, quel que soit l'état de départ.

-- 0. Reset ------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.search_users_by_username(text);
drop function if exists public.get_my_friend_data();
drop function if exists public.get_my_class_invitations();
drop function if exists public.get_class_members(uuid);
drop function if exists public.get_class_feed(uuid);
drop function if exists public.count_pending_invitations();
drop function if exists public.get_direct_shares_received();
drop function if exists public.is_class_member(uuid, uuid);

drop policy if exists "lesson_photos_select_own" on storage.objects;
drop policy if exists "lesson_photos_insert_own" on storage.objects;
drop policy if exists "lesson_photos_delete_own" on storage.objects;

drop table if exists public.shared_content cascade;
drop table if exists public.class_invitations cascade;
drop table if exists public.class_members cascade;
drop table if exists public.classes cascade;
drop table if exists public.friend_requests cascade;
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
  summary_text text,
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

-- 6. Amis et classes virtuelles ----------------------------------------------
-- Toutes les tables sont créées d'abord, puis toutes les policies ensuite :
-- comme certaines policies référencent plusieurs de ces tables entre elles
-- (ex: class_members_insert a besoin de class_invitations), les créer dans
-- cet ordre évite toute référence à une table qui n'existe pas encore.

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user_id <> to_user_id),
  unique (from_user_id, to_user_id)
);

alter table public.friend_requests enable row level security;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

alter table public.class_members enable row level security;

create table public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (class_id, to_user_id)
);

alter table public.class_invitations enable row level security;

-- Sert aux deux formes de partage : soit class_id est renseigné (partage
-- dans une classe), soit shared_with_user_id l'est (partage direct à un ami
-- précis, sans classe) — jamais les deux à la fois.
create table public.shared_content (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  shared_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, lesson_id),
  constraint shared_content_target_check check (
    (class_id is not null and shared_with_user_id is null)
    or (class_id is null and shared_with_user_id is not null)
  )
);

create unique index shared_content_direct_lesson_uniq
  on public.shared_content (shared_with_user_id, lesson_id)
  where shared_with_user_id is not null;

alter table public.shared_content enable row level security;

-- Security definer : évite la récursion RLS quand class_members a besoin de
-- vérifier l'appartenance à la classe dans sa PROPRE policy de select, et
-- sert aussi aux autres tables (shared_content, lessons, quiz_sets) pour
-- vérifier l'appartenance sans exposer class_members directement.
create or replace function public.is_class_member(p_class_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id and user_id = p_user_id
  );
$$;

create policy "friend_requests_select" on public.friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "friend_requests_insert" on public.friend_requests
  for insert with check (auth.uid() = from_user_id);

create policy "friend_requests_update" on public.friend_requests
  for update using (auth.uid() = to_user_id) with check (auth.uid() = to_user_id);

create policy "friend_requests_delete" on public.friend_requests
  for delete using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "classes_select" on public.classes
  for select using (auth.uid() = owner_id or public.is_class_member(id, auth.uid()));

create policy "classes_insert" on public.classes
  for insert with check (auth.uid() = owner_id);

create policy "classes_update" on public.classes
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "classes_delete" on public.classes
  for delete using (auth.uid() = owner_id);

create policy "class_members_select" on public.class_members
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
    or public.is_class_member(class_id, auth.uid())
  );

-- Un membre ne peut s'auto-ajouter que s'il est le créateur de la classe, ou
-- si son invitation a déjà été marquée acceptée (voir class_invitations plus
-- bas : le flux d'acceptation met à jour le statut PUIS insère la ligne ici).
create policy "class_members_insert" on public.class_members
  for insert with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
      or exists (
        select 1 from public.class_invitations ci
        where ci.class_id = class_members.class_id
          and ci.to_user_id = auth.uid()
          and ci.status = 'accepted'
      )
    )
  );

create policy "class_members_delete" on public.class_members
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
  );

create policy "class_invitations_select" on public.class_invitations
  for select using (
    auth.uid() = from_user_id
    or auth.uid() = to_user_id
    or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
  );

-- Seul le créateur de la classe invite, et uniquement des amis confirmés
-- (demande d'ami acceptée dans un sens ou l'autre).
create policy "class_invitations_insert" on public.class_invitations
  for insert with check (
    auth.uid() = from_user_id
    and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.from_user_id = auth.uid() and fr.to_user_id = class_invitations.to_user_id)
          or (fr.to_user_id = auth.uid() and fr.from_user_id = class_invitations.to_user_id)
        )
    )
  );

create policy "class_invitations_update" on public.class_invitations
  for update using (auth.uid() = to_user_id) with check (auth.uid() = to_user_id);

create policy "class_invitations_delete" on public.class_invitations
  for delete using (
    auth.uid() = from_user_id
    or auth.uid() = to_user_id
    or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
  );

create policy "shared_content_select" on public.shared_content
  for select using (
    auth.uid() = shared_by_user_id
    or (class_id is not null and public.is_class_member(class_id, auth.uid()))
    or shared_with_user_id = auth.uid()
  );

-- Partage dans une classe : il faut en être membre. Partage direct à un
-- ami : il faut que la demande d'ami soit acceptée dans un sens ou l'autre.
create policy "shared_content_insert" on public.shared_content
  for insert with check (
    auth.uid() = shared_by_user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
    and (
      (class_id is not null and public.is_class_member(class_id, auth.uid()))
      or (
        shared_with_user_id is not null
        and exists (
          select 1 from public.friend_requests fr
          where fr.status = 'accepted'
            and (
              (fr.from_user_id = auth.uid() and fr.to_user_id = shared_content.shared_with_user_id)
              or (fr.to_user_id = auth.uid() and fr.from_user_id = shared_content.shared_with_user_id)
            )
        )
      )
    )
  );

create policy "shared_content_delete" on public.shared_content
  for delete using (
    auth.uid() = shared_by_user_id
    or (class_id is not null and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid()))
  );

-- Politiques additives (en plus de "lessons_all_own") qui donnent un accès en
-- LECTURE SEULE à qui une leçon a été partagée (classe ou ami direct).
-- L'écriture (modifier/supprimer/régénérer) reste réservée au propriétaire.

create policy "lessons_select_shared" on public.lessons
  for select using (
    exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = lessons.id
        and (
          (sc.class_id is not null and public.is_class_member(sc.class_id, auth.uid()))
          or sc.shared_with_user_id = auth.uid()
        )
    )
  );

-- quiz_sets avait une seule policy "for all" basée sur quiz_sets.user_id ;
-- on la remplace par une policy de lecture (propriétaire OU classe/ami à qui
-- la leçon est partagée) et des policies d'écriture basées sur la vraie
-- propriété de la LEÇON (pas la colonne user_id, que quiconque pourrait
-- essayer de renseigner autrement lors d'un upsert).
drop policy if exists "quiz_sets_all_own" on public.quiz_sets;

create policy "quiz_sets_select" on public.quiz_sets
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = quiz_sets.lesson_id
        and (
          (sc.class_id is not null and public.is_class_member(sc.class_id, auth.uid()))
          or sc.shared_with_user_id = auth.uid()
        )
    )
  );

-- La toute première génération (quand aucune ligne n'existe encore) est
-- ouverte à qui la leçon est partagée, pas seulement au propriétaire : sinon
-- "Réviser cette leçon" échoue tant que le propriétaire ne l'a pas fait
-- lui-même en premier. Modifier/régénérer une ligne déjà existante reste
-- réservé au vrai propriétaire (quiz_sets_update).
create policy "quiz_sets_insert" on public.quiz_sets
  for insert with check (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
    or exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = quiz_sets.lesson_id
        and (
          (sc.class_id is not null and public.is_class_member(sc.class_id, auth.uid()))
          or sc.shared_with_user_id = auth.uid()
        )
    )
  );

create policy "quiz_sets_update" on public.quiz_sets
  for update using (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
  );

create policy "quiz_sets_delete" on public.quiz_sets
  for delete using (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
  );

create or replace function public.search_users_by_username(query text)
returns table(id uuid, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username
  from public.profiles p
  where p.username is not null
    and p.username ilike query || '%'
    and p.id <> auth.uid()
  order by p.username
  limit 10;
$$;

create or replace function public.get_my_friend_data()
returns table(relation text, request_id uuid, user_id uuid, username text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select 'friend', fr.id,
    case when fr.from_user_id = auth.uid() then fr.to_user_id else fr.from_user_id end,
    p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p
    on p.id = (case when fr.from_user_id = auth.uid() then fr.to_user_id else fr.from_user_id end)
  where fr.status = 'accepted' and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  union all
  select 'incoming', fr.id, fr.from_user_id, p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.from_user_id
  where fr.status = 'pending' and fr.to_user_id = auth.uid()
  union all
  select 'outgoing', fr.id, fr.to_user_id, p.username, fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.to_user_id
  where fr.status = 'pending' and fr.from_user_id = auth.uid();
$$;

create or replace function public.get_my_class_invitations()
returns table(id uuid, class_id uuid, class_name text, from_username text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select ci.id, ci.class_id, c.name, p.username, ci.created_at
  from public.class_invitations ci
  join public.classes c on c.id = ci.class_id
  join public.profiles p on p.id = ci.from_user_id
  where ci.status = 'pending' and ci.to_user_id = auth.uid()
  order by ci.created_at desc;
$$;

create or replace function public.get_class_members(p_class_id uuid)
returns table(user_id uuid, username text, joined_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select cm.user_id, p.username, cm.joined_at
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = p_class_id and public.is_class_member(p_class_id, auth.uid())
  order by cm.joined_at;
$$;

create or replace function public.get_class_feed(p_class_id uuid)
returns table(
  id uuid, lesson_id uuid, lesson_title text, subject_name text,
  shared_by_username text, created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select sc.id, sc.lesson_id, l.title, s.name, p.username, sc.created_at
  from public.shared_content sc
  join public.lessons l on l.id = sc.lesson_id
  join public.subjects s on s.id = l.subject_id
  join public.profiles p on p.id = sc.shared_by_user_id
  where sc.class_id = p_class_id and public.is_class_member(p_class_id, auth.uid())
  order by sc.created_at desc;
$$;

create or replace function public.get_direct_shares_received()
returns table(
  id uuid, lesson_id uuid, lesson_title text, subject_name text,
  shared_by_username text, created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select sc.id, sc.lesson_id, l.title, s.name, p.username, sc.created_at
  from public.shared_content sc
  join public.lessons l on l.id = sc.lesson_id
  join public.subjects s on s.id = l.subject_id
  join public.profiles p on p.id = sc.shared_by_user_id
  where sc.shared_with_user_id = auth.uid()
  order by sc.created_at desc;
$$;

create or replace function public.count_pending_invitations()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select (
    (select count(*) from public.friend_requests where to_user_id = auth.uid() and status = 'pending')
    + (select count(*) from public.class_invitations where to_user_id = auth.uid() and status = 'pending')
  )::integer;
$$;
