create table if not exists public.daily_quiz_results (
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
