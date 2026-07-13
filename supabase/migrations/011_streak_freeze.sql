alter table public.profiles
  add column if not exists streak_freezes integer not null default 1,
  add column if not exists longest_streak integer not null default 0;

grant update (streak_freezes, longest_streak) on public.profiles to authenticated;
