-- Profiles and sync codes. Every device signs in anonymously and gets its own profile; devices that share a
-- sync code share one profile (settings, votes, weighting, tip-jar state). The server only stores a SHA-256 hash
-- of the 12-word code. Profiles are reached only through the functions below (no table policies).

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  prefs jsonb not null default '{}',
  prefs_updated_at timestamptz,
  tips_state jsonb not null default '{}',
  sync_code_hash text unique check (sync_code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

alter table public.devices add column profile_id uuid references public.profiles(id) on delete set null;
create index devices_profile_id_idx on public.devices(profile_id);

-- Existing devices: one profile each.
do $$
declare d record; p uuid;
begin
  for d in select id from public.devices where profile_id is null loop
    insert into public.profiles default values returning id into p;
    update public.devices set profile_id = p where id = d.id;
  end loop;
end $$;

-- New devices get a fresh profile. A profile_id sent by the client is ignored; a repeat insert of an existing
-- device (the app's upsert on every launch) keeps its current profile instead of creating an empty one.
create or replace function public.devices_assign_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select d.profile_id into new.profile_id from public.devices d where d.id = new.id;
  if new.profile_id is null then
    insert into public.profiles default values returning id into new.profile_id;
  end if;
  return new;
end $$;
create trigger devices_assign_profile before insert on public.devices
  for each row execute function public.devices_assign_profile();

create or replace function public.my_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select d.profile_id from public.devices d where d.id = auth.uid()
$$;

-- Join attempts, for the 5-per-hour limit.
create table public.sync_join_attempts (
  device_id uuid not null,
  at timestamptz not null default now()
);
create index sync_join_attempts_device_at_idx on public.sync_join_attempts(device_id, at);
alter table public.sync_join_attempts enable row level security;
revoke all on public.sync_join_attempts from anon, authenticated;

-- Everything the app needs about its profile in one call.
create or replace function public.get_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'prefs', p.prefs,
    'prefs_updated_at', p.prefs_updated_at,
    'tips_state', p.tips_state,
    'sync_code_hash', p.sync_code_hash,
    'devices', (select count(*) from public.devices d where d.profile_id = p.id),
    'completions', (select count(*) from public.events e join public.devices d on d.id = e.device_id
                     where d.profile_id = p.id and e.event_type = 'complete' and e.content_type = 'exercise'),
    'my_events', (select count(*) from public.events e where e.device_id = auth.uid()))
  from public.profiles p
  where p.id = public.my_profile_id()
$$;

-- Save synced settings (latest change wins) and/or merge tip-jar state.
create or replace function public.save_profile(p_prefs jsonb default null, p_prefs_updated_at timestamptz default null,
                                               p_tips_state jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if pg_column_size(p_prefs) > 4000 or pg_column_size(p_tips_state) > 1000 then raise exception 'too_large'; end if;
  update public.profiles p set
    prefs = case when p_prefs is not null and (p.prefs_updated_at is null or p_prefs_updated_at >= p.prefs_updated_at)
                 then p_prefs else p.prefs end,
    prefs_updated_at = case when p_prefs is not null and (p.prefs_updated_at is null or p_prefs_updated_at >= p.prefs_updated_at)
                 then coalesce(p_prefs_updated_at, now()) else p.prefs_updated_at end,
    tips_state = case when p_tips_state is not null then p.tips_state || p_tips_state else p.tips_state end,
    updated_at = now()
  where p.id = public.my_profile_id();
end $$;

-- Set (or replace) this profile's sync code. Linked devices stay linked.
create or replace function public.set_sync_code(p_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad_hash'; end if;
  update public.profiles set sync_code_hash = p_hash, updated_at = now() where id = public.my_profile_id();
end $$;

-- Move this device into the profile with this code. p_keep_history = false clears this device's own history first.
create or replace function public.join_profile(p_hash text, p_keep_history boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); old uuid; target uuid; tries int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select count(*) into tries from public.sync_join_attempts where device_id = me and at > now() - interval '1 hour';
  if tries >= 5 then return jsonb_build_object('ok', false, 'reason', 'too_many_tries'); end if;
  insert into public.sync_join_attempts(device_id) values (me);
  select id into target from public.profiles where sync_code_hash = p_hash;
  if target is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  old := public.my_profile_id();
  if old is distinct from target then
    if not p_keep_history then delete from public.events where device_id = me; end if;
    update public.devices set profile_id = target where id = me;
    delete from public.profiles p where p.id = old and not exists (select 1 from public.devices d where d.profile_id = old);
  end if;
  delete from public.sync_join_attempts where device_id = me;
  return public.get_profile() || jsonb_build_object('ok', true);
end $$;

-- Devices in this profile, this one first.
create or replace function public.linked_devices() returns table(id uuid, name text, last_seen_at timestamptz, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name, d.last_seen_at, d.id = auth.uid()
    from public.devices d
   where d.profile_id = public.my_profile_id()
   order by d.id = auth.uid() desc, d.last_seen_at desc
$$;

-- Take a device out of this profile. It keeps its own history and a copy of the settings, under a new profile.
create or replace function public.unlink_device(p_device uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare prof uuid := public.my_profile_id(); np uuid;
begin
  if not exists (select 1 from public.devices d where d.id = p_device and d.profile_id = prof) then raise exception 'not_linked'; end if;
  insert into public.profiles(prefs, prefs_updated_at) select p.prefs, p.prefs_updated_at from public.profiles p where p.id = prof
    returning id into np;
  update public.devices set profile_id = np where id = p_device;
end $$;

-- "Download my data": everything stored for this profile.
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'settings', p.prefs,
    'tip_jar', p.tips_state,
    'has_sync_code', p.sync_code_hash is not null,
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('name', d.name, 'created_at', d.created_at, 'last_seen_at', d.last_seen_at,
                  'this_device', d.id = auth.uid()) order by d.created_at), '[]') from public.devices d where d.profile_id = p.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('device', d.name, 'at', e.created_at, 'event', e.event_type,
                  'content_type', e.content_type, 'content_id', e.content_id, 'session', e.session_id) order by e.created_at), '[]')
                 from public.events e join public.devices d on d.id = e.device_id where d.profile_id = p.id))
  from public.profiles p where p.id = public.my_profile_id()
$$;

-- "Delete my data": this device only, or everything on all synced devices. Removes history, device records,
-- the profile once empty, and the anonymous sign-ins themselves.
create or replace function public.delete_my_data(p_scope text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); prof uuid := public.my_profile_id(); ids uuid[];
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_scope = 'everything' then ids := array(select d.id from public.devices d where d.profile_id = prof);
  elsif p_scope = 'device' then ids := array[me];
  else raise exception 'bad_scope'; end if;
  if not me = any(ids) then ids := ids || me; end if;
  delete from public.events where device_id = any(ids);
  delete from public.sync_join_attempts where device_id = any(ids);
  delete from public.devices where id = any(ids);
  delete from public.profiles p where p.id = prof and not exists (select 1 from public.devices d where d.profile_id = prof);
  delete from auth.users where id = any(ids);
end $$;

-- Weighting reads every device in the profile, not just this one.
do $$
declare def text; n int;
begin
  def := pg_get_functiondef('public.device_content_weights(public.content_type, public.exercise_type)'::regprocedure);
  n := (length(def) - length(replace(def, 'e.device_id = me.uid', ''))) / length('e.device_id = me.uid');
  if n <> 2 then raise exception 'expected 2 device filters in device_content_weights, found %', n; end if;
  execute replace(def, 'e.device_id = me.uid',
    'e.device_id in (select d.id from public.devices d where d.profile_id = (select d2.profile_id from public.devices d2 where d2.id = me.uid))');
end $$;

-- Only signed-in devices may call these.
revoke execute on function public.devices_assign_profile() from public, anon, authenticated;
revoke execute on function public.my_profile_id(), public.get_profile(), public.save_profile(jsonb, timestamptz, jsonb),
  public.set_sync_code(text), public.join_profile(text, boolean), public.linked_devices(), public.unlink_device(uuid),
  public.export_my_data(), public.delete_my_data(text) from public, anon;
grant execute on function public.my_profile_id(), public.get_profile(), public.save_profile(jsonb, timestamptz, jsonb),
  public.set_sync_code(text), public.join_profile(text, boolean), public.linked_devices(), public.unlink_device(uuid),
  public.export_my_data(), public.delete_my_data(text) to authenticated;
