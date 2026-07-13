alter table public.lessons
  add column if not exists summary_text text;

grant update (summary_text) on public.lessons to authenticated;
