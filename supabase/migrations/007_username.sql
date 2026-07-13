alter table public.profiles
  add column if not exists username text;

-- Autorise aussi la modification de cette nouvelle colonne (les
-- autorisations sont accordées colonne par colonne depuis la migration
-- 005, "username" doit être ajoutée explicitement).
grant update (username) on public.profiles to authenticated;
