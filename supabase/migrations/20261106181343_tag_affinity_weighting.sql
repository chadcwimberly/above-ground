-- Tag affinity: exercises that share tags with what this device has voted on are picked more or less often.
--
-- For each tag, a device's net score = up-votes minus down-votes on exercises carrying that tag
-- (latest vote per exercise wins, all categories counted: taste in techniques carries across).
--   * A tag counts only once |net| >= 2 votes.
--   * Its strength grows with each further vote: 2 -> 0.2, 3 -> 0.4 ... 6+ -> 1.0.
--   * It is scaled by rarity: a tag on nearly every exercise (e.g. "mental") counts very little,
--     a rare one (e.g. "music") counts close to fully. rarity = ln(N / n) / ln(N), N = active exercises.
-- An exercise's affinity = sum of its tags' (strength * rarity * sign), clamped to [-1, 1].
--   * affinity > 0 and the exercise has never been seen       -> weight x (1 + affinity)      (up to x2)
--   * affinity < 0 and the exercise has no vote of its own    -> weight x (1 + 0.5 * affinity) (down to x0.5)
--   * A direct vote on the exercise always overrides its tag affinity.
-- Applies to exercises only; affirmations are weighted as before.
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
  ),
  -- ---- tag affinity (exercises only) ----
  ex_votes as (                       -- this device's current vote on every exercise, any category
    select v.content_id,
           case v.last_vote when 'vote_up' then 1 when 'vote_down' then -1 else 0 end as vote
      from (select e.content_id,
                   (array_agg(e.event_type order by e.created_at desc, e.id desc))[1] as last_vote
              from public.events e, me
             where p_content_type = 'exercise'
               and me.uid is not null
               and e.device_id = me.uid
               and e.content_type = 'exercise'
               and e.event_type in ('vote_up','vote_down','vote_clear')
             group by e.content_id) v
  ),
  pool as (select count(*)::numeric as n from public.exercises where is_active),
  tag_use as (                        -- how many active exercises carry each tag
    select ct.tag_id, count(*)::numeric as n
      from public.content_tags ct
      join public.exercises x on x.id = ct.content_id and x.is_active
     where ct.content_type = 'exercise'
     group by ct.tag_id
  ),
  tag_taste as (                      -- net votes per tag, only once past the threshold
    select ct.tag_id, sum(v.vote)::numeric as net
      from ex_votes v
      join public.content_tags ct on ct.content_type = 'exercise' and ct.content_id = v.content_id
     where v.vote <> 0
     group by ct.tag_id
    having abs(sum(v.vote)) >= 2
  ),
  tag_score as (
    select tt.tag_id,
           sign(tt.net) * least(1.0, (abs(tt.net) - 1) / 5.0)
           * case when p.n > 1 then greatest(0.0, ln(p.n / tu.n) / ln(p.n)) else 0.0 end as score
      from tag_taste tt
      join tag_use tu on tu.tag_id = tt.tag_id
      cross join pool p
  ),
  affinity as (
    select ct.content_id, greatest(-1.0, least(1.0, sum(ts.score))) as a
      from tag_score ts
      join public.content_tags ct on ct.tag_id = ts.tag_id and ct.content_type = 'exercise'
     group by ct.content_id
  )
  select s.content_id, s.views, s.shuffles, s.vote,
         round((
           1.0
           * case when s.views = 0 then 3.0 else 1.0 end                     -- never seen: pick more
           * case s.vote when 1 then 2.5 when -1 then 0.2 else 1.0 end       -- up/down votes
           * ((s.views + 1.0) / (s.views + 1.0 + 2.0 * s.shuffles))          -- high shuffle-to-view ratio: pick less
           * case                                                            -- tag affinity (see header)
               when s.vote <> 0 or af.a is null      then 1.0
               when af.a > 0 and s.views = 0         then 1.0 + af.a
               when af.a < 0                         then 1.0 + 0.5 * af.a
               else 1.0
             end
         )::numeric, 4) as weight
    from s left join affinity af on af.content_id = s.content_id;
$$;
