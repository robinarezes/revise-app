-- Un membre d'une classe qui ouvre une leçon partagée pour la première fois
-- (avant même le propriétaire) doit pouvoir générer son QCM/flashcards/
-- exercices, pas seulement les lire une fois qu'ils existent déjà : sinon
-- "Réviser cette leçon" échoue silencieusement (bloqué par la RLS) tant que
-- le propriétaire ne l'a pas fait lui-même en premier.
-- Modifier/régénérer reste réservé au vrai propriétaire (quiz_sets_update),
-- seule la toute première création est ouverte aux membres de la classe.

drop policy if exists "quiz_sets_insert" on public.quiz_sets;

create policy "quiz_sets_insert" on public.quiz_sets
  for insert with check (
    exists (select 1 from public.lessons l where l.id = quiz_sets.lesson_id and l.user_id = auth.uid())
    or exists (
      select 1 from public.shared_content sc
      where sc.lesson_id = quiz_sets.lesson_id and public.is_class_member(sc.class_id, auth.uid())
    )
  );
