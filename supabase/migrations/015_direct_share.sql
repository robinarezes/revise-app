-- Partage direct d'une leçon à un ami, sans passer par une classe.
-- shared_content sert désormais aux deux cas : soit class_id est renseigné
-- (partage dans une classe), soit shared_with_user_id l'est (partage direct
-- à un ami précis) — jamais les deux à la fois.

alter table public.shared_content alter column class_id drop not null;

alter table public.shared_content
  add column if not exists shared_with_user_id uuid references auth.users(id) on delete cascade;

alter table public.shared_content
  drop constraint if exists shared_content_target_check;
alter table public.shared_content
  add constraint shared_content_target_check check (
    (class_id is not null and shared_with_user_id is null)
    or (class_id is null and shared_with_user_id is not null)
  );

create unique index if not exists shared_content_direct_lesson_uniq
  on public.shared_content (shared_with_user_id, lesson_id)
  where shared_with_user_id is not null;

drop policy if exists "shared_content_select" on public.shared_content;
create policy "shared_content_select" on public.shared_content
  for select using (
    auth.uid() = shared_by_user_id
    or (class_id is not null and public.is_class_member(class_id, auth.uid()))
    or shared_with_user_id = auth.uid()
  );

drop policy if exists "shared_content_insert" on public.shared_content;
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

-- lessons_select_shared / quiz_sets_select / quiz_sets_insert ne géraient
-- que le cas "classe" : on les remplace pour couvrir aussi le partage direct.

drop policy if exists "lessons_select_shared" on public.lessons;
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

drop policy if exists "quiz_sets_select" on public.quiz_sets;
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

drop policy if exists "quiz_sets_insert" on public.quiz_sets;
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
