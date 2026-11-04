-- Note: the exercise_type enum ('anxiety','depression','grounding','ideation','motivation') and
-- exercises.category (exercise_type[]) were created in the Supabase dashboard, outside migrations.
alter table public.affirmations add column category exercise_type[];
update public.affirmations set category = array['grounding']::exercise_type[];
