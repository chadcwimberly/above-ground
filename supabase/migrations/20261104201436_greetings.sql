-- Welcome-screen greetings. `contexts` says when a greeting fits; the app weights and picks among the fitting ones.
-- Allowed contexts: any, earlyMorning, morning, afternoon, evening, lateNight, weekend, firstVisit, returning, returnedToday
-- Rows (the greetings themselves) live only in Supabase; edit them in the Table Editor.
create table public.greetings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  body text not null,
  contexts text[] not null default '{any}'
    check (contexts <@ array['any','earlyMorning','morning','afternoon','evening','lateNight','weekend','firstVisit','returning','returnedToday']
           and cardinality(contexts) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.greetings enable row level security;
create policy "read active" on public.greetings for select to anon, authenticated using (is_active);
