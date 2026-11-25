-- Completion messages get categories like exercises and affirmations, so bedtime sessions can end with
-- "sleep well" instead of "go back to your day". Existing messages fit the daytime categories only.
alter table public.completion_messages add column if not exists category public.exercise_type[];
update public.completion_messages set category = array['anxiety','depression','grounding']::public.exercise_type[] where category is null;
-- Topic tag for the new sleep exercises (used by tag-affinity weighting).
insert into public.tags (category, slug, name) select 'topic', 'sleep', 'Sleep'
  where not exists (select 1 from public.tags where slug = 'sleep');
