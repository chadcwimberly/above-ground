-- Experience upgrades (app 1.4.0): research notes and audio on exercises, crisis resources, reminder messages.
-- All additive; older app versions are unaffected.

-- "Why this works": a plain-language summary and its sources, shown under an exercise when present.
-- sources: [{ "title": "...", "year": 2023, "url": "https://..." }]
alter table public.exercises add column research_summary text;
alter table public.exercises add column sources jsonb not null default '[]';
-- Optional recorded guide for the exercise (e.g. a file in Supabase Storage).
alter table public.exercises add column audio_url text;

-- Crisis lines shown by "Need more help?". country = ISO 3166-1 alpha-2, or '*' for the worldwide fallback.
create table public.crisis_resources (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  country_name text not null,
  name text not null,
  description text,
  phone text,          -- dialable number, e.g. '988'
  sms text,            -- number to text, e.g. '988'
  sms_body text,       -- optional keyword to prefill
  url text,            -- website or chat page
  emergency text,      -- local emergency number, e.g. '911'
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.crisis_resources enable row level security;
create policy "read active" on public.crisis_resources for select to anon, authenticated using (is_active);

-- Gentle reminder notifications (native apps). One is picked at random for each scheduled reminder.
create table public.reminder_messages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.reminder_messages enable row level security;
create policy "read active" on public.reminder_messages for select to anon, authenticated using (is_active);
