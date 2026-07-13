alter table public.profiles
  add column if not exists dyslexia_font text not null default 'system',
  add column if not exists dyslexia_tint text not null default 'cream',
  add column if not exists dyslexia_size text not null default 'medium',
  add column if not exists tts_voice text not null default 'alloy';

grant update (dyslexia_font, dyslexia_tint, dyslexia_size, tts_voice) on public.profiles
  to authenticated;
