-- Amis et classes virtuelles : demandes d'ami par pseudo, classes avec
-- membres invités parmi ses amis, et partage de leçons/exercices dans une
-- classe. Toute la logique multi-utilisateurs (recherche de pseudo, listes
-- avec noms d'utilisateur) passe par des fonctions security definer plutôt
-- que d'ouvrir la table profiles, pour ne jamais exposer plus que id+pseudo.

-- 1. Demandes d'ami --------------------------------------------------------

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

create policy "friend_requests_select" on public.friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "friend_requests_insert" on public.friend_requests
  for insert with check (auth.uid() = from_user_id);

create policy "friend_requests_update" on public.friend_requests
  for update using (auth.uid() = to_user_id) with check (auth.uid() = to_user_id);

create policy "friend_requests_delete" on public.friend_requests
  for delete using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- 2. Classes virtuelles -----------------------------------------------------

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

-- 3. Invitations à une classe -----------------------------------------------

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

-- 4. Leçons partagées dans une classe ----------------------------------------

create table public.shared_content (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  shared_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, lesson_id)
);

alter table public.shared_content enable row level security;

create policy "shared_content_select" on public.shared_content
  for select using (
    auth.uid() = shared_by_user_id or public.is_class_member(class_id, auth.uid())
  );

create policy "shared_content_insert" on public.shared_content
  for insert with check (
    auth.uid() = shared_by_user_id
    and public.is_class_member(class_id, auth.uid())
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

create policy "shared_content_delete" on public.shared_content
  for delete using (
    auth.uid() = shared_by_user_id
    or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = auth.uid())
  );

-- 5. Lecture des leçons/exercices partagés -----------------------------------
-- Politiques additives (en plus de "lessons_all_own" / "quiz_sets_all_own")
-- qui donnent un accès en LECTURE SEULE aux membres d'une classe où la leçon
-- a été partagée. L'écriture (modifier/supprimer/régénérer) reste réservée
-- au propriétaire réel de la leçon.

create policy "lessons_select_shared" on public.lessons
  for select using (
    exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = lessons.id and public.is_class_member(sc.class_id, auth.uid())
    )
  );

-- quiz_sets avait une seule policy "for all" basée sur quiz_sets.user_id ;
-- on la remplace par une policy de lecture (propriétaire OU classe où la
-- leçon est partagée) et des policies d'écriture basées sur la vraie
-- propriété de la LEÇON (pas la colonne user_id, que quiconque pourrait
-- essayer de renseigner autrement lors d'un upsert).
drop policy if exists "quiz_sets_all_own" on public.quiz_sets;

create policy "quiz_sets_select" on public.quiz_sets
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = quiz_sets.lesson_id and public.is_class_member(sc.class_id, auth.uid())
    )
  );

create policy "quiz_sets_insert" on public.quiz_sets
  for insert with check (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
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

-- 6. Fonctions de lecture (recherche de pseudo, listes avec noms) -----------

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
