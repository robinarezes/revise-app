alter table public.profiles
  add column if not exists subscription_status text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_current_period_end timestamptz;

-- Un utilisateur ne doit jamais pouvoir modifier son propre statut
-- d'abonnement depuis le navigateur (la policy RLS "profiles_update_own"
-- autorise déjà la ligne, mais pas la colonne) : seules les colonnes
-- gérées côté client restent modifiables par le rôle "authenticated".
-- Les colonnes d'abonnement ne sont écrites que par le webhook Stripe,
-- via la clé service_role qui n'est pas soumise à ces restrictions.
revoke update on public.profiles from authenticated;
grant update (grade, lv1, lv2, dyslexia_mode, xp, streak, last_active_date) on public.profiles
  to authenticated;

-- Même logique pour la création de profil (filet de sécurité de
-- ProfileContext) : seule la colonne "id" est insérable, le reste garde
-- ses valeurs par défaut (statut "free" notamment).
revoke insert on public.profiles from authenticated;
grant insert (id) on public.profiles to authenticated;
