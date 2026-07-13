-- Permet à un même code premium d'être utilisé par plusieurs personnes
-- (un code = un cadeau à partager), au lieu d'une seule fois au total.
-- La colonne premium_codes.redeemed_by n'est plus utilisée mais reste en
-- place (inoffensive) pour ne pas casser d'anciennes données.

create table if not exists public.premium_code_redemptions (
  code text not null references public.premium_codes(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.premium_code_redemptions enable row level security;

-- Aucune policy : accessible uniquement depuis le serveur (service_role),
-- comme premium_codes.
