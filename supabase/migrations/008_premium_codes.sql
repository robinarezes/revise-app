create table if not exists public.premium_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz
);

alter table public.premium_codes enable row level security;

-- Volontairement aucune policy : cette table n'est accessible que depuis le
-- serveur (clé service_role, qui contourne les RLS), jamais directement
-- depuis le navigateur. Les utilisateurs passent par /api/stripe-checkout
-- (action "redeem-code") pour l'utiliser.
