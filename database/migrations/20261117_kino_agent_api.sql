-- Agent credentials and receipts are server-only. Existing account policies are untouched.
create table public.kino_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  scopes text[] not null check (cardinality(scopes) > 0 and scopes <@ array['read','write']),
  language text not null check (language in ('en','pt','fr','it','no','es','de')),
  timezone text not null,
  default_list_id uuid references public.watchlists(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index kino_agent_tokens_owner_idx on public.kino_agent_tokens(user_id);
create table public.kino_agent_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bucket bigint not null,
  hits integer not null
);
create table public.kino_agent_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  key text not null,
  fingerprint text not null,
  request_id uuid not null,
  token_id uuid references public.kino_agent_tokens(id) on delete set null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, key)
);

alter table public.kino_agent_tokens enable row level security;
alter table public.kino_agent_rate enable row level security;
alter table public.kino_agent_receipts enable row level security;
revoke all on public.kino_agent_tokens, public.kino_agent_rate, public.kino_agent_receipts from public, anon, authenticated;
grant select, insert, update on public.kino_agent_tokens to service_role;

alter table public.watch_diary add column agent_event_rating numeric(2,1);
alter table public.watch_diary add column agent_event boolean not null default false;
alter table public.episode_ratings add column agent_batch_id uuid;

create index kino_agent_diary_keyset_idx on public.watch_diary(user_id, watched_at desc, id desc);
create index kino_agent_episode_keyset_idx on public.episode_ratings(user_id, watched_at desc, id desc);
create index kino_agent_episode_lookup_idx on public.episode_ratings(user_id, title_id, season_number, episode_number);

create function public.kino_agent_auth(p_hash text, p_scope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.kino_agent_tokens;
  epoch_seconds bigint := floor(extract(epoch from clock_timestamp()));
  minute_bucket bigint := epoch_seconds / 60;
  request_count integer;
begin
  select * into t from public.kino_agent_tokens
    where token_hash = p_hash and revoked_at is null and expires_at > clock_timestamp();
  if not found then return jsonb_build_object('error', 'unauthorized'); end if;

  insert into public.kino_agent_rate as rate(user_id, bucket, hits)
    values (t.user_id, minute_bucket, 1)
    on conflict (user_id) do update
      set hits = case when rate.bucket < excluded.bucket then 1 else least(rate.hits + 1, 61) end,
          bucket = greatest(rate.bucket, excluded.bucket)
    returning hits into request_count;
  return jsonb_build_object(
    'user_id', t.user_id, 'language', t.language, 'timezone', t.timezone,
    'default_list_id', t.default_list_id, 'today', (clock_timestamp() at time zone t.timezone)::date,
    'error', case when request_count > 60 then 'rate_limited' when not (p_scope = any(t.scopes)) then 'forbidden' end,
    'retry_after', case when request_count > 60 then 60 - epoch_seconds % 60 end
  );
end $$;

create function public.kino_agent_list_ref(p_list public.watchlists)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id', p_list.id, 'name', p_list.name, 'description', p_list.description,
    'visibility', p_list.visibility, 'item_count',
    (select count(*) from public.watchlist_items where watchlist_id = p_list.id))
$$;

create function public.kino_agent_lists(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.kino_agent_list_ref(w) ||
    jsonb_build_object('owned', w.user_id = p_user, 'editable', w.user_id = p_user or c.can_edit)
    order by w.name, w.id), '[]'::jsonb)
  from public.watchlists w
  left join public.watchlist_collaborators c on c.watchlist_id = w.id and c.user_id = p_user
  where w.user_id = p_user or c.id is not null
$$;

-- Probe before catalog calls, then check again under the write lock.
create function public.kino_agent_replay(p_user uuid, p_operation text, p_key text, p_fingerprint text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when fingerprint <> p_fingerprint then jsonb_build_object('error', 'idempotency_conflict')
    when p_operation = 'add_to_watchlist' and not exists (
      select 1 from public.watchlists w where w.id = (receipt#>>'{list,id}')::uuid
        and (w.user_id = p_user or w.visibility = 'public' or exists (
          select 1 from public.watchlist_collaborators c where c.watchlist_id = w.id and c.user_id = p_user
        ))
    ) then jsonb_build_object('error', 'list_not_found')
    else receipt end
  from public.kino_agent_receipts
  where user_id = p_user and operation = p_operation and key = p_key
$$;

create function public.kino_agent_write(
  p_hash text, p_operation text, p_key text, p_fingerprint text, p_request_id uuid,
  p_args jsonb, p_title_id uuid, p_context jsonb, p_today date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.kino_agent_tokens;
  w public.watchlists;
  previous public.watch_diary;
  title_type text;
  result jsonb;
  selected jsonb;
  marked jsonb;
  skipped jsonb;
  released jsonb := p_context->'released';
  next_episode jsonb;
  event_id uuid;
  watched_count integer;
  released_count integer;
  watch_kind text;
  rating_value numeric := (p_args->>'rating')::numeric;
  watch_date date := coalesce((p_args->>'watched_on')::date, p_today);
  event_time timestamptz;
  rating_id uuid;
  previous_rating numeric;
begin
  -- Serialize all agent writes for this account, including distinct next-episode requests.
  select * into t from public.kino_agent_tokens where token_hash = p_hash;
  if not found then return jsonb_build_object('error', 'unauthorized'); end if;
  perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || t.user_id::text, 0));
  select * into t from public.kino_agent_tokens where token_hash = p_hash
    and revoked_at is null and expires_at > clock_timestamp() for share;
  if not found then return jsonb_build_object('error', 'unauthorized'); end if;
  if not ('write' = any(t.scopes)) then return jsonb_build_object('error', 'forbidden'); end if;

  result := public.kino_agent_replay(t.user_id, p_operation, p_key, p_fingerprint);
  if result is not null then return result; end if;

  if watch_date > p_today then return jsonb_build_object('error', 'validation_error'); end if;
  event_time := case when (p_args->>'watched_on') is null and (clock_timestamp() at time zone t.timezone)::date = p_today then clock_timestamp()
    else (watch_date + time '12:00') at time zone t.timezone end;

  if p_operation = 'create_watchlist' then
    select * into w from public.watchlists where user_id = t.user_id
      and lower(normalize(btrim(name))) = lower(normalize(btrim(p_args->>'name'))) order by id limit 1;
    if found then return jsonb_build_object('error', 'name_conflict', 'candidates',
      jsonb_build_array(public.kino_agent_list_ref(w))); end if;
    insert into public.watchlists(user_id, name, description, visibility, is_shared)
      values (t.user_id, p_args->>'name', p_args->>'description', p_args->>'visibility', false)
      returning * into w;
    result := jsonb_build_object('list', public.kino_agent_list_ref(w));
  elsif p_operation = 'add_to_watchlist' then
    select * into w from public.watchlists where id = (p_args->>'list_id')::uuid
      and (user_id = t.user_id or visibility = 'public' or exists (
        select 1 from public.watchlist_collaborators where watchlist_id = watchlists.id and user_id = t.user_id
      )) for update;
    if not found then return jsonb_build_object('error', 'list_not_found'); end if;
    if w.user_id <> t.user_id then
      perform 1 from public.watchlist_collaborators where watchlist_id = w.id and user_id = t.user_id
        and can_edit for share;
      if not found then return jsonb_build_object('error', 'forbidden'); end if;
    end if;
    insert into public.watchlist_items(watchlist_id, title_id, added_by)
      values (w.id, p_title_id, t.user_id)
      on conflict (watchlist_id, title_id) do nothing returning id into event_id;
    if event_id is not null then
      update public.watchlists set updated_at = clock_timestamp() where id = w.id returning * into w;
    end if;
    result := jsonb_build_object('status', case when event_id is null then 'already_present' else 'added' end,
      'title', p_context->'title', 'list', public.kino_agent_list_ref(w));
  elsif p_operation = 'log_watch' then
    select type into title_type from public.titles where id = p_title_id;
    if title_type = 'tv' and rating_value is not null then
      return jsonb_build_object('error', 'invalid_rating');
    end if;
    select * into previous from public.watch_diary where user_id = t.user_id and title_id = p_title_id
      and watched_at <= event_time order by watched_at desc, id desc limit 1;
    if previous.agent_event then
      previous_rating := previous.agent_event_rating;
    elsif previous.id is not null then
      select rating into previous_rating from public.title_ratings
        where user_id = t.user_id and title_id = p_title_id and watched_at = previous.watched_at;
    end if;
    watch_kind := case when previous.id is not null or (p_args->>'rewatch')::boolean then 'rewatch' else 'first-time' end;
    insert into public.watch_diary(user_id, title_id, watched_at, watch_type, agent_event, agent_event_rating)
      values (t.user_id, p_title_id, event_time, watch_kind, true, rating_value) returning id into event_id;
    if rating_value is not null then
      select id into rating_id from public.title_ratings where user_id = t.user_id and title_id = p_title_id
        order by watched_at desc, id desc limit 1 for update;
      if rating_id is null then
        insert into public.title_ratings(user_id, title_id, rating, watched_at, watch_type)
          values (t.user_id, p_title_id, rating_value, event_time, watch_kind);
      else
        update public.title_ratings set rating = rating_value, watched_at = greatest(watched_at, event_time),
          watch_type = case when watched_at <= event_time then watch_kind else watch_type end,
          updated_at = clock_timestamp() where id = rating_id;
      end if;
    end if;
    result := jsonb_build_object('entry', jsonb_build_object(
      'id', event_id, 'title', p_context->'title', 'rating', rating_value, 'watched_on', watch_date,
      'date_defaulted', (p_args->>'watched_on') is null, 'is_rewatch', watch_kind = 'rewatch',
      'previous_entry', case when previous.id is not null then jsonb_build_object(
        'id', previous.id, 'watched_on', (previous.watched_at at time zone t.timezone)::date,
        'is_rewatch', previous.watch_type = 'rewatch', 'rating', previous_rating) end));
  elsif p_operation = 'mark_episodes' then
    -- Keep next selection, gap detection and writes in the same transaction.
    with eligible as (
      select e, ordinal, (e->>'season')::int as season, (e->>'episode')::int as episode,
        exists (select 1 from public.episode_ratings r where r.user_id = t.user_id
          and r.title_id = p_title_id and r.season_number = (e->>'season')::int
          and r.episode_number = (e->>'episode')::int) as watched
      from jsonb_array_elements(released) with ordinality as items(e, ordinal)
    ), picked as (
      select * from eligible where case p_args#>>'{selector,type}'
        when 'first_n' then ordinal <= (p_args#>>'{selector,n}')::int
        when 'next_unwatched' then not watched and season > 0
        when 'range' then season = (p_args#>>'{selector,season}')::int
          and episode between (p_args#>>'{selector,from}')::int and (p_args#>>'{selector,to}')::int
        when 'season' then season = (p_args#>>'{selector,season}')::int
      end order by ordinal limit (p_args#>>'{selector,count}')::int
    )
    select coalesce(jsonb_agg(e order by ordinal) filter (where not watched), '[]'),
           coalesce(jsonb_agg(e order by ordinal) filter (where watched), '[]')
      into selected, skipped from picked;

    with inserted as (
      insert into public.episode_ratings(user_id, title_id, season_number, episode_number,
        rating, watched_at, watch_type, runtime_minutes, agent_batch_id)
      select t.user_id, p_title_id, (e->>'season')::int, (e->>'episode')::int,
        rating_value, event_time, 'first-time', (e->>'runtime_min')::int, p_request_id
      from jsonb_array_elements(selected) as items(e)
      on conflict (user_id,title_id,season_number,episode_number,watched_at) do nothing
      returning season_number, episode_number
    )
    select coalesce(jsonb_agg(e order by ordinal) filter (where i.episode_number is not null), '[]'),
      skipped || coalesce(jsonb_agg(e order by ordinal) filter (where i.episode_number is null), '[]')
      into marked, skipped
      from jsonb_array_elements(selected) with ordinality as items(e, ordinal)
      left join inserted i on i.season_number = (e->>'season')::int and i.episode_number = (e->>'episode')::int;

    with progress as (
      select e, ordinal, exists (
        select 1 from public.episode_ratings where user_id = t.user_id and title_id = p_title_id
          and season_number = (e->>'season')::int and episode_number = (e->>'episode')::int
      ) as watched
      from jsonb_array_elements(released) with ordinality as items(e, ordinal) where (e->>'season')::int > 0
    )
    select count(*) filter (where watched), count(*), (array_agg(e order by ordinal) filter (where not watched))[1]
      into watched_count, released_count, next_episode from progress;
    result := jsonb_build_object('series', p_context->'title', 'resolved_episodes', marked,
      'skipped_already_watched', skipped, 'watched_on', watch_date, 'date_defaulted', (p_args->>'watched_on') is null,
      'rating_applied', case when jsonb_array_length(marked) > 0 then rating_value end,
      'rating_scope', case when rating_value is not null and jsonb_array_length(marked) > 0
        then 'each_newly_watched_episode' else 'none' end,
      'progress', jsonb_build_object('watched', watched_count, 'total', released_count,
        'season', coalesce((next_episode->>'season')::int, nullif((released->-1->>'season')::int, 0)),
        'next_episode', next_episode));
    if jsonb_array_length(marked) = 0 then result := result || jsonb_build_object('error', 'nothing_to_mark'); end if;
  else
    return jsonb_build_object('error', 'validation_error');
  end if;

  insert into public.kino_agent_receipts(user_id,operation,key,fingerprint,request_id,token_id,receipt)
    values (t.user_id,p_operation,p_key,p_fingerprint,p_request_id,t.id,result);
  return result;
end $$;


create function public.kino_agent_diary(
  p_user uuid, p_timezone text, p_since date, p_until date, p_collapse boolean,
  p_before_time timestamptz, p_before_id uuid, p_limit integer
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with diary as (
    select d.id, d.title_id, d.watched_at, d.watch_type = 'rewatch' as is_rewatch,
      case when d.agent_event then d.agent_event_rating else r.rating end as rating,
      left(regexp_replace(regexp_replace(v.content, '<[^>]+>', '', 'g'), '[[:cntrl:]]+', ' ', 'g'), 140) as review_excerpt,
      null::jsonb as episodes
    from public.watch_diary d
    left join public.title_ratings r on r.user_id = d.user_id and r.title_id = d.title_id and r.watched_at = d.watched_at
    left join public.reviews v on v.user_id = d.user_id and v.title_id = d.title_id
    where d.user_id = p_user
      and (p_since is null or d.watched_at >= (p_since::timestamp at time zone p_timezone))
      and (p_until is null or d.watched_at < ((p_until + 1)::timestamp at time zone p_timezone))
  ), episodes as (
    select (array_agg(e.id order by e.id))[1] as id, e.title_id, e.watched_at,
      bool_or(e.watch_type = 'rewatch') as is_rewatch,
      case when count(e.rating) = count(*) and min(e.rating) = max(e.rating) then min(e.rating) end as rating,
      null::text as review_excerpt,
      jsonb_build_object('season', e.season_number, 'count', count(*),
        'from', case when count(*) = max(e.episode_number) - min(e.episode_number) + 1 then min(e.episode_number) end,
        'to', case when count(*) = max(e.episode_number) - min(e.episode_number) + 1 then max(e.episode_number) end,
        'items', jsonb_agg(jsonb_build_object('id', e.id, 'episode', e.episode_number, 'rating', e.rating,
          'is_rewatch', e.watch_type = 'rewatch', 'runtime_min', e.runtime_minutes) order by e.episode_number, e.id)) as episodes
    from public.episode_ratings e
    where e.user_id = p_user
      and (p_since is null or e.watched_at >= (p_since::timestamp at time zone p_timezone))
      and (p_until is null or e.watched_at < ((p_until + 1)::timestamp at time zone p_timezone))
    group by e.title_id, e.watched_at, e.season_number, e.agent_batch_id,
      case when not p_collapse then e.id end
  ), page as (
    select * from (select * from diary union all select * from episodes) as events
    where p_before_time is null or (watched_at, id) < (p_before_time, p_before_id)
    order by watched_at desc, id desc limit p_limit + 1
  )
  select jsonb_build_object(
    'total', (select count(*) from diary) + (select count(*) from episodes),
    'entries', coalesce(jsonb_agg((to_jsonb(page) - 'title_id') || jsonb_build_object(
      'watched_on', (page.watched_at at time zone p_timezone)::date,
      'watched_at', to_char(page.watched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+00:00',
      'catalog', jsonb_build_object('tmdb_id', t.tmdb_id, 'type', t.type, 'title', t.title,
        'release_year', t.release_year, 'cover_image', t.cover_image))
      order by page.watched_at desc, page.id desc), '[]')
  )
  from page join public.titles t on t.id = page.title_id
$$;

create function public.kino_agent_taste(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with latest_title_ratings as (
    select distinct on (title_id) title_id, rating from public.title_ratings
    where user_id = p_user order by title_id, watched_at desc, id desc
  ), latest_episodes as (
    select distinct on (title_id, season_number, episode_number) title_id, rating
    from public.episode_ratings where user_id = p_user
    order by title_id, season_number, episode_number, watched_at desc, id desc
  ), episode_signals as (
    select title_id, round(avg(rating), 2) as rating from latest_episodes
    where rating is not null group by title_id
  ), rated as (
    select coalesce(e.title_id, r.title_id) as title_id,
      coalesce(r.rating, e.rating) as rating,
      case when r.rating is not null then 'title_rating' else 'episode_average' end as rating_source
    from latest_title_ratings r full join episode_signals e on e.title_id = r.title_id
  ), history as (
    select title_id, max(watched_at) as watched_at from (
      select title_id, watched_at from public.watch_diary where user_id = p_user
      union all select title_id, watched_at from public.title_ratings where user_id = p_user
      union all select title_id, watched_at from public.episode_ratings where user_id = p_user
    ) h group by title_id
  ), media as (
    select t.id, t.type, t.genres, r.rating, r.rating_source, h.watched_at,
      jsonb_build_object('tmdb_id', t.tmdb_id, 'type', t.type, 'title', t.title,
        'release_year', t.release_year, 'cover_image', t.cover_image) as catalog
    from history h join public.titles t on t.id = h.title_id left join rated r on r.title_id = h.title_id
  ), distribution as (
    select rating, count(*) as n from latest_title_ratings group by rating
  ), weights as (
    select g->>'name' as genre, count(*) as rated_titles, round(avg(rating), 2) as average_rating
    from media cross join lateral jsonb_array_elements(
      case when jsonb_typeof(media.genres) = 'array' then media.genres else '[]' end
    ) as genres(g)
    where rating is not null and g->>'name' is not null
    group by g->>'name'
  )
  select jsonb_build_object(
    'top_rated', coalesce((select jsonb_agg(to_jsonb(s) order by s.rating desc, s.watched_at desc, s.id)
      from (select id, catalog, rating, rating_source, watched_at from media where rating is not null
        order by rating desc, watched_at desc, id limit 10) s), '[]'),
    'recent', coalesce((select jsonb_agg(to_jsonb(s) order by s.watched_at desc, s.id)
      from (select id, catalog, rating, rating_source, watched_at from media order by watched_at desc, id limit 10) s), '[]'),
    'genre_weights', coalesce((select jsonb_agg(to_jsonb(weights) order by average_rating desc, genre) from weights), '[]'),
    'rating_distribution', coalesce((select jsonb_object_agg(rating, n) from distribution), '{}'),
    'counts', jsonb_build_object('movies', (select count(*) from media where type = 'movie'),
      'series', (select count(*) from media where type = 'tv'),
      'episodes', (select count(*) from latest_episodes),
      'rated_titles', (select count(*) from rated))
  )
$$;

create function public.kino_agent_candidate_state(p_user uuid, p_candidates jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c->>'id',
    'watched', exists(select 1 from public.watch_diary where user_id = p_user and title_id = t.id)
      or exists(select 1 from public.title_ratings where user_id = p_user and title_id = t.id)
      or exists(select 1 from public.episode_ratings where user_id = p_user and title_id = t.id),
    'in_watchlist', exists(select 1 from public.watchlist_items wi
      join public.watchlists w on w.id = wi.watchlist_id where wi.title_id = t.id
      and (w.user_id = p_user or exists(select 1 from public.watchlist_collaborators
        where watchlist_id = w.id and user_id = p_user)))
  )), '[]')
  from jsonb_array_elements(p_candidates) as candidates(c)
  left join public.titles t on t.tmdb_id = (c->>'tmdb_id')::integer and t.type = c->>'media_type'
$$;

revoke all on function public.kino_agent_auth(text,text),
  public.kino_agent_list_ref(public.watchlists), public.kino_agent_lists(uuid),
  public.kino_agent_replay(uuid,text,text,text),
  public.kino_agent_write(text,text,text,text,uuid,jsonb,uuid,jsonb,date),
  public.kino_agent_diary(uuid,text,date,date,boolean,timestamptz,uuid,integer),
  public.kino_agent_taste(uuid), public.kino_agent_candidate_state(uuid,jsonb)
from public, anon, authenticated;

grant execute on function public.kino_agent_auth(text,text), public.kino_agent_lists(uuid),
  public.kino_agent_replay(uuid,text,text,text),
  public.kino_agent_write(text,text,text,text,uuid,jsonb,uuid,jsonb,date),
  public.kino_agent_diary(uuid,text,date,date,boolean,timestamptz,uuid,integer),
  public.kino_agent_taste(uuid), public.kino_agent_candidate_state(uuid,jsonb)
to service_role;
