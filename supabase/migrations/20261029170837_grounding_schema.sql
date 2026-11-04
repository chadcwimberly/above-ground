create type content_type as enum ('exercise', 'affirmation', 'message');
create type event_type as enum
  ('view','next','back','refresh','vote_up','vote_down','vote_clear','complete','restart');

create table exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  kind text not null default 'steps',
  body jsonb not null default '{}',
  est_seconds int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table affirmations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  body_html text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table completion_messages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  slug text unique not null,
  name text not null
);
create table content_tags (
  content_type content_type not null,
  content_id uuid not null,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (content_type, content_id, tag_id)
);

create table devices (
  id uuid primary key,
  nickname text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table events (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  session_id uuid not null,
  content_type content_type not null,
  content_id uuid not null,
  event_type event_type not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (content_type, content_id, event_type);
create index on events (device_id, created_at);

alter table exercises enable row level security;
alter table affirmations enable row level security;
alter table completion_messages enable row level security;
alter table tags enable row level security;
alter table content_tags enable row level security;
alter table devices enable row level security;
alter table events enable row level security;

create policy "read active" on exercises for select to anon, authenticated using (is_active);
create policy "read active" on affirmations for select to anon, authenticated using (is_active);
create policy "read active" on completion_messages for select to anon, authenticated using (is_active);
create policy "read" on tags for select to anon, authenticated using (true);
create policy "read" on content_tags for select to anon, authenticated using (true);
create policy "register self" on devices for insert to authenticated
  with check (id = (select auth.uid()));
create policy "touch self" on devices for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "log own" on events for insert to authenticated
  with check (device_id = (select auth.uid()));

revoke update on devices from anon, authenticated;
grant update (last_seen_at) on devices to authenticated;

create view content_stats with (security_invoker = true) as
select s.*, coalesce(x.title, left(regexp_replace(a.body_html, '<[^>]+>', '', 'g'), 60), m.body) as label
from (
  select content_type, content_id,
    count(*) filter (where event_type = 'view')      as views,
    count(*) filter (where event_type = 'refresh')   as refreshes,
    count(*) filter (where event_type = 'next')      as nexts,
    count(*) filter (where event_type = 'complete')  as completions,
    count(*) filter (where event_type = 'vote_up')   as ups,
    count(*) filter (where event_type = 'vote_down') as downs,
    count(distinct device_id)                        as devices
  from events group by 1, 2
) s
left join exercises x on s.content_type = 'exercise' and x.id = s.content_id
left join affirmations a on s.content_type = 'affirmation' and a.id = s.content_id
left join completion_messages m on s.content_type = 'message' and m.id = s.content_id;

create view device_item_stats with (security_invoker = true) as
select e.device_id, d.nickname, e.content_type, e.content_id,
  count(*) filter (where e.event_type = 'view')      as views,
  count(*) filter (where e.event_type = 'refresh')   as refreshes,
  count(*) filter (where e.event_type = 'complete')  as completions,
  count(*) filter (where e.event_type = 'vote_up')   as ups,
  count(*) filter (where e.event_type = 'vote_down') as downs,
  max(e.created_at)                                  as last_event
from events e join devices d on d.id = e.device_id
group by e.device_id, d.nickname, e.content_type, e.content_id;

revoke all on content_stats, device_item_stats from anon, authenticated;
