-- A finer choice inside a category. Sleep uses it after "How can your sleep be improved?":
-- 'body' (physically restless), 'mind' (mentally restless), 'not-tired'. Null = shown for every focus.
alter table public.exercises add column if not exists focus text[];
