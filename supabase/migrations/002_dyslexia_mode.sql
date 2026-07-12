-- Ajoute la préférence "mode dyslexique" au profil.
-- Migration additive (ne touche pas aux données existantes) — safe à
-- exécuter une ou plusieurs fois.

alter table public.profiles
  add column if not exists dyslexia_mode boolean not null default false;
