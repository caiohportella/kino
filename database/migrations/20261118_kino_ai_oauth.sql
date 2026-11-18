-- Kino OAuth uses existing Auth users and Agent API receipts and mutations.
create table public.kino_ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
create table public.kino_ai_clients (
  id text primary key,
  redirect_uris text[] not null,
  display_name text not null,
  verified boolean not null default false
);
create table public.kino_ai_flows (
  id uuid primary key default gen_random_uuid(),
  browser_hash text not null,
  client_id text not null,
  client_name text not null,
  verified boolean not null,
  redirect_uri text not null,
  resource text not null,
  scopes text[] not null,
  state text,
  challenge text not null,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  outcome text,
  code_hash text unique,
  code_expires_at timestamptz,
  consumed_at timestamptz,
  language text,
  timezone text
);
create table public.kino_ai_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  resource text not null,
  scopes text[] not null,
  language text not null,
  timezone text not null,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz
);
create table public.kino_ai_refresh (
  hash text primary key,
  grant_id uuid not null references public.kino_ai_grants(id) on delete cascade,
  scopes text[] not null,
  consumed_at timestamptz
);
alter table public.kino_agent_tokens add column oauth_grant_id uuid references public.kino_ai_grants(id) on delete cascade;
create index kino_ai_grants_user_idx on public.kino_ai_grants(user_id);
create index kino_agent_tokens_grant_idx on public.kino_agent_tokens(oauth_grant_id);
create index kino_ai_flows_user_idx on public.kino_ai_flows(user_id);
create index kino_ai_flows_expiry_idx on public.kino_ai_flows(expires_at);
create index kino_ai_refresh_grant_idx on public.kino_ai_refresh(grant_id);

alter table public.kino_ai_preferences enable row level security;
alter table public.kino_ai_clients enable row level security;
alter table public.kino_ai_flows enable row level security;
alter table public.kino_ai_grants enable row level security;
alter table public.kino_ai_refresh enable row level security;
revoke all on public.kino_ai_preferences,public.kino_ai_clients,public.kino_ai_flows,public.kino_ai_grants,public.kino_ai_refresh from public,anon,authenticated;
grant select on public.kino_ai_preferences to service_role;
grant select,insert on public.kino_ai_clients to service_role;
grant insert on public.kino_ai_flows to service_role;
-- Previous manually issued credentials require migration to a fresh OAuth grant.
update public.kino_agent_tokens set revoked_at = now() where revoked_at is null;

create function public.kino_ai_revoke_grant(p_grant uuid)
returns void language sql security definer set search_path = '' as $$
  update public.kino_ai_grants set revoked_at = clock_timestamp() where id = p_grant and revoked_at is null;
  update public.kino_agent_tokens set revoked_at = clock_timestamp() where oauth_grant_id = p_grant and revoked_at is null;
$$;

create function public.kino_ai_set_enabled(p_user uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || p_user::text, 0));
  insert into public.kino_ai_preferences(user_id, enabled) values (p_user,p_enabled)
    on conflict(user_id) do update set enabled = excluded.enabled;
  if not p_enabled then
    update public.kino_ai_grants set revoked_at = clock_timestamp() where user_id = p_user and revoked_at is null;
    update public.kino_agent_tokens set revoked_at = clock_timestamp() where user_id = p_user and revoked_at is null;
    delete from public.kino_ai_flows where user_id = p_user;
  end if;
end $$;

create function public.kino_ai_consent(
  p_flow uuid, p_browser text, p_user uuid, p_decision text, p_code_hash text, p_language text, p_timezone text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f public.kino_ai_flows;
  allowed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || p_user::text, 0));
  select * into f from public.kino_ai_flows where id = p_flow and browser_hash = p_browser
    and expires_at > clock_timestamp() and outcome is null and (user_id is null or user_id = p_user) for update;
  if not found then return null; end if;
  if f.user_id is null then update public.kino_ai_flows set user_id = p_user where id = f.id; end if;
  allowed := exists(select 1 from public.kino_ai_preferences where user_id = p_user and enabled);
  if p_decision = 'enable' then
    perform public.kino_ai_set_enabled(p_user, true);
    allowed := true;
  elsif p_decision = 'deny' then
    update public.kino_ai_flows set outcome = 'denied' where id = f.id;
    return jsonb_build_object('redirect_uri',f.redirect_uri,'state',f.state);
  elsif p_decision = 'approve' then
    if not allowed then return null; end if;
    if not exists (select 1 from pg_timezone_names where name = p_timezone) then p_timezone := 'UTC'; end if;
    update public.kino_ai_flows set outcome = 'approved', code_hash = p_code_hash,
      code_expires_at = clock_timestamp() + interval '2 minutes', language = p_language, timezone = p_timezone
      where id = f.id;
    return jsonb_build_object('redirect_uri',f.redirect_uri,'state',f.state);
  end if;
  return jsonb_build_object('client_name',f.client_name,'verified',f.verified,'scopes',f.scopes,'enabled',allowed);
end $$;

create function public.kino_ai_exchange(
  p_kind text, p_hash text, p_client text, p_redirect text, p_challenge text, p_resource text,
  p_access_hash text, p_refresh_hash text, p_requested text[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f public.kino_ai_flows;
  g public.kino_ai_grants;
  r public.kino_ai_refresh;
  who uuid;
  deadline timestamptz;
  granted_scopes text[];
begin
  if p_kind = 'authorization_code' then
    select user_id into who from public.kino_ai_flows where code_hash = p_hash;
  else
    select grants.user_id into who from public.kino_ai_refresh refresh
      join public.kino_ai_grants grants on grants.id = refresh.grant_id where refresh.hash = p_hash;
  end if;
  if who is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || who::text, 0));
  if not exists(select 1 from public.kino_ai_preferences where user_id = who and enabled) then return null; end if;

  if p_kind = 'authorization_code' then
    select * into f from public.kino_ai_flows where user_id = who and code_hash = p_hash and outcome = 'approved'
      and client_id = p_client and redirect_uri = p_redirect and challenge = p_challenge
      and resource = p_resource and consumed_at is null and code_expires_at > clock_timestamp() for update;
    if not found then return null; end if;
    update public.kino_ai_flows set consumed_at = clock_timestamp() where id = f.id;
    insert into public.kino_ai_grants(user_id,client_id,resource,scopes,language,timezone)
      values (who,f.client_id,f.resource,f.scopes,f.language,f.timezone) returning * into g;
    granted_scopes := g.scopes;
  else
    select * into r from public.kino_ai_refresh where hash = p_hash for update;
    select * into g from public.kino_ai_grants where id = r.grant_id and user_id = who
      and client_id = p_client and resource = p_resource and revoked_at is null and expires_at > clock_timestamp();
    if not found then return null; end if;
    if r.consumed_at is not null then
      perform public.kino_ai_revoke_grant(g.id);
      return null;
    end if;
    if p_requested is not null and not (p_requested <@ r.scopes) then
      return jsonb_build_object('error','invalid_scope');
    end if;
    granted_scopes := coalesce(p_requested,r.scopes);
    update public.kino_ai_refresh set consumed_at = clock_timestamp() where hash = p_hash;
  end if;

  deadline := least(g.expires_at, clock_timestamp() + interval '5 minutes');
  insert into public.kino_agent_tokens(user_id,token_hash,name,scopes,language,timezone,default_list_id,expires_at,oauth_grant_id)
    values (who,p_access_hash,'AI Integration',granted_scopes,g.language,g.timezone,
      (select w.id from public.kino_agent_tokens t join public.watchlists w on w.id = t.default_list_id
        where t.user_id = who and w.user_id = who and t.oauth_grant_id is null
        order by t.created_at desc limit 1),deadline,g.id);
  insert into public.kino_ai_refresh(hash,grant_id,scopes) values (p_refresh_hash,g.id,granted_scopes);
  return jsonb_build_object('scopes',granted_scopes,'expires_in',greatest(0,floor(extract(epoch from deadline-clock_timestamp()))));
end $$;

create function public.kino_ai_revoke(p_hash text, p_client text, p_resource text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.kino_ai_grants;
begin
  select * into g from public.kino_ai_grants where client_id = p_client and resource = p_resource
    and id = coalesce(
      (select grant_id from public.kino_ai_refresh where hash = p_hash),
      (select oauth_grant_id from public.kino_agent_tokens where token_hash = p_hash));
  if found then
    perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || g.user_id::text, 0));
    perform public.kino_ai_revoke_grant(g.id);
  end if;
end $$;

create function public.kino_ai_access(p_hash text, p_resource text)
returns text[] language sql stable security definer set search_path = '' as $$
  select t.scopes from public.kino_agent_tokens t
  join public.kino_ai_grants g on g.id = t.oauth_grant_id and g.user_id = t.user_id
  join public.kino_ai_preferences p on p.user_id = t.user_id and p.enabled
  where t.token_hash = p_hash and t.revoked_at is null and t.expires_at > now()
    and g.resource = p_resource and g.revoked_at is null and g.expires_at > now()
$$;

alter function public.kino_agent_auth(text,text) rename to kino_agent_auth_core;
create function public.kino_agent_auth(p_hash text, p_scope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.kino_agent_tokens t join public.kino_ai_preferences p
    on t.user_id = p.user_id and p.enabled where t.token_hash = p_hash) then
    return jsonb_build_object('error','unauthorized');
  end if;
  return public.kino_agent_auth_core(p_hash,p_scope);
end $$;

alter function public.kino_agent_write(text,text,text,text,uuid,jsonb,uuid,jsonb,date) rename to kino_agent_write_core;
create function public.kino_agent_write(
  p_hash text, p_operation text, p_key text, p_fingerprint text, p_request_id uuid,
  p_args jsonb, p_title_id uuid, p_context jsonb, p_today date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare who uuid;
begin
  select user_id into who from public.kino_agent_tokens where token_hash = p_hash;
  if who is null then return jsonb_build_object('error','unauthorized'); end if;
  perform pg_advisory_xact_lock(hashtextextended('kino-agent:' || who::text, 0));
  if not exists(select 1 from public.kino_ai_preferences where user_id = who and enabled) then
    return jsonb_build_object('error','unauthorized');
  end if;
  return public.kino_agent_write_core(
    p_hash,p_operation,p_key,p_fingerprint,p_request_id,p_args,p_title_id,p_context,p_today);
end $$;

revoke all on function public.kino_agent_auth_core(text,text),
  public.kino_agent_write_core(text,text,text,text,uuid,jsonb,uuid,jsonb,date),
  public.kino_ai_revoke_grant(uuid) from public,anon,authenticated,service_role;

revoke all on function public.kino_ai_set_enabled(uuid,boolean),
  public.kino_ai_consent(uuid,text,uuid,text,text,text,text),
  public.kino_ai_exchange(text,text,text,text,text,text,text,text,text[]),public.kino_ai_revoke(text,text,text),
  public.kino_ai_access(text,text),public.kino_agent_auth(text,text),
  public.kino_agent_write(text,text,text,text,uuid,jsonb,uuid,jsonb,date) from public,anon,authenticated;
grant execute on function public.kino_ai_set_enabled(uuid,boolean),
  public.kino_ai_consent(uuid,text,uuid,text,text,text,text),
  public.kino_ai_exchange(text,text,text,text,text,text,text,text,text[]),public.kino_ai_revoke(text,text,text),
  public.kino_ai_access(text,text),public.kino_agent_auth(text,text),
  public.kino_agent_write(text,text,text,text,uuid,jsonb,uuid,jsonb,date) to service_role;
