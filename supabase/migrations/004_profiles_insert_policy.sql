-- Permet à un utilisateur connecté de créer sa propre ligne de profil si elle
-- n'existe pas encore (filet de sécurité : normalement le trigger
-- on_auth_user_created s'en charge à l'inscription, mais un compte créé
-- avant ce trigger, ou dont la ligne a été supprimée par erreur, se
-- retrouvait bloqué sur un écran blanc sans aucun moyen de s'en sortir).
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
