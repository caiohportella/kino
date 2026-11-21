-- Run only in an empty, isolated database. Requires the Kino schema and agent migration.
grant select (id), update (code_expires_at) on public.kino_ai_flows to service_role;

insert into auth.users(id) values
  ('a0000000-0000-4000-8000-000000000000'),
  ('b0000000-0000-4000-8000-000000000000'),
  ('c0000000-0000-4000-8000-000000000000');

-- Existing Agent API regression accounts explicitly opt in.
select public.kino_ai_set_enabled(id, true) from auth.users;

-- Separate users start with OAuth disabled.
insert into auth.users(id) values
  ('d0000000-0000-4000-8000-000000000000'),
  ('e0000000-0000-4000-8000-000000000000');

insert into public.watchlists(id,user_id,name,visibility) values
  ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000000','Watchlist','private'),
  ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000000','Must Binge','private'),
  ('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000000','Other private list','private'),
  ('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000000','Other public list','public'),
  ('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000000','Shared editing','private');

insert into public.watchlist_collaborators(watchlist_id,user_id,can_edit)
  values ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000000',true);

insert into public.titles(id,tmdb_id,type,title,release_year) values
  ('a0000000-0000-4002-8000-000000000001',95396,'tv','Severance',2022),
  ('a0000000-0000-4002-8000-000000000002',5920,'tv','The Mentalist',2008),
  ('a0000000-0000-4002-8000-000000000003',329865,'movie','Arrival',2016),
  ('a0000000-0000-4002-8000-000000000004',152601,'movie','Her',2013),
  ('a0000000-0000-4002-8000-000000000005',17431,'movie','Moon',2009),
  ('a0000000-0000-4002-8000-000000000006',264660,'movie','Ex Machina',2014),
  ('a0000000-0000-4002-8000-000000000007',782,'movie','Gattaca',1997);

insert into public.title_ratings(user_id,title_id,rating,watch_type,watched_at)
  select 'a0000000-0000-4000-8000-000000000000',id,5,'first-time','2024-01-01T12:00:00Z'
  from public.titles where tmdb_id in (329865,152601,17431,264660);

insert into public.watchlist_items(watchlist_id,title_id,added_by) values
  ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4002-8000-000000000007','a0000000-0000-4000-8000-000000000000');

insert into public.episode_ratings(user_id,title_id,season_number,episode_number,rating,watch_type,watched_at) values
  ('a0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000001',1,1,3.5,'first-time','2024-01-01T12:00:00Z'),
  ('a0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000002',1,1,null,'first-time','2024-01-01T12:00:00Z'),
  ('a0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000002',1,3,null,'first-time','2024-01-01T12:00:00Z');

insert into public.watch_diary(user_id,title_id,watched_at,watch_type) values
  ('b0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000007','2025-12-01T12:00:00Z','first-time');

create function public.kino_test_reject_episode_four() returns trigger language plpgsql as $$
begin
  if new.user_id = 'c0000000-0000-4000-8000-000000000000' and new.episode_number = 4 then
    raise check_violation using message = 'test-only rollback fixture';
  end if;
  return new;
end $$;
create trigger kino_test_reject_episode_four before insert on public.episode_ratings
  for each row execute function public.kino_test_reject_episode_four();
