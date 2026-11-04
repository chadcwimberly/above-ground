-- Per-device weights for every active exercise/affirmation.
-- Only the CALLING device's events (auth.uid()) are ever considered.
create or replace function public.device_content_weights(
  p_content_type public.content_type,
  p_category public.exercise_type default null
)
returns table (
  content_id uuid,
  views int,
  shuffles int,
  vote int,          -- +1 up, -1 down, 0 none/cleared (latest vote event wins)
  weight numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  items as (
    select x.id from public.exercises x
     where p_content_type = 'exercise' and x.is_active
       and (p_category is null or p_category = any(x.category))
    union all
    select a.id from public.affirmations a
     where p_content_type = 'affirmation' and a.is_active
       and (p_category is null or p_category = any(a.category))
  ),
  ev as (
    select e.content_id,
           count(*) filter (where e.event_type = 'view')::int    as views,
           count(*) filter (where e.event_type = 'refresh')::int as shuffles,
           (array_agg(e.event_type order by e.created_at desc, e.id desc)
              filter (where e.event_type in ('vote_up','vote_down','vote_clear')))[1] as last_vote
      from public.events e, me
     where me.uid is not null
       and e.device_id = me.uid
       and e.content_type = p_content_type
     group by e.content_id
  ),
  s as (
    select i.id as content_id,
           coalesce(ev.views, 0)    as views,
           coalesce(ev.shuffles, 0) as shuffles,
           case ev.last_vote when 'vote_up' then 1 when 'vote_down' then -1 else 0 end as vote
      from items i left join ev on ev.content_id = i.id
  )
  select content_id, views, shuffles, vote,
         round((
           1.0
           * case when views = 0 then 3.0 else 1.0 end                 -- never seen: pick more
           * case vote when 1 then 2.5 when -1 then 0.2 else 1.0 end   -- up/down votes
           * ((views + 1.0) / (views + 1.0 + 2.0 * shuffles))          -- high shuffle-to-view ratio: pick less
         )::numeric, 4) as weight
    from s;
$$;

-- Weighted random pick (Efraimidis–Spirakis). Returns the full row as JSON.
-- p_exclude: ids to avoid (e.g. the item just shown when shuffling); ignored if it would leave nothing.
create or replace function public.pick_content(
  p_content_type public.content_type,
  p_category public.exercise_type,
  p_exclude uuid[] default '{}'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select w.content_id into v_id
    from public.device_content_weights(p_content_type, p_category) w
   where not (w.content_id = any(coalesce(p_exclude, '{}')))
   order by -ln(1.0 - random()) / greatest(w.weight, 0.0001)
   limit 1;

  if v_id is null then
    select w.content_id into v_id
      from public.device_content_weights(p_content_type, p_category) w
     order by -ln(1.0 - random()) / greatest(w.weight, 0.0001)
     limit 1;
  end if;

  if v_id is null then return null; end if;

  if p_content_type = 'exercise' then
    return (select to_jsonb(x) from public.exercises x where x.id = v_id);
  else
    return (select to_jsonb(a) from public.affirmations a where a.id = v_id);
  end if;
end;
$$;

revoke all on function public.device_content_weights(public.content_type, public.exercise_type) from public;
revoke all on function public.pick_content(public.content_type, public.exercise_type, uuid[]) from public;
grant execute on function public.device_content_weights(public.content_type, public.exercise_type) to anon, authenticated;
grant execute on function public.pick_content(public.content_type, public.exercise_type, uuid[]) to anon, authenticated;
