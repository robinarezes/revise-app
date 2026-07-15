-- Fonction "bouton" pour recharger le cache de schéma PostgREST à distance,
-- sans repasser par le SQL Editor à chaque fois. Une fois cette migration
-- posée (et le cache rechargé une dernière fois pour qu'elle soit connue),
-- l'app peut appeler cette fonction elle-même via une simple requête RPC.

create or replace function public.pgrst_reload_schema()
returns void
language sql
security definer
set search_path = public
as $$
  select pg_notify('pgrst', 'reload schema');
$$;

grant execute on function public.pgrst_reload_schema() to authenticated;

-- On en profite pour vérifier que la colonne existe bel et bien (et pas
-- seulement absente du cache) : si cette ligne échoue avec "column does not
-- exist", c'est que summary_text n'a en réalité jamais été ajoutée, et il
-- faudra la recréer plutôt que simplement recharger le cache.
alter table public.lessons add column if not exists summary_text text;

select pg_notify('pgrst', 'reload schema');
