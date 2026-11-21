-- Browser-only data on top of the shared integration fixture.
grant select on public.user_profiles to anon, authenticated, service_role;
insert into public.user_profiles(id, username, display_name) values
  ('d0000000-0000-4000-8000-000000000000', 'fixture_owner', 'Fixture Owner'),
  ('e0000000-0000-4000-8000-000000000000', 'fixture_other', 'Fixture Other');

insert into public.watch_diary(user_id,title_id,watched_at,watch_type) values
  ('d0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000003','2025-12-01T12:00:00Z','first-time'),
  ('e0000000-0000-4000-8000-000000000000','a0000000-0000-4002-8000-000000000007','2025-12-01T12:00:00Z','first-time');

insert into public.watchlists(id, user_id, name, visibility) values
  ('d0000000-0000-4001-8000-000000000000', 'd0000000-0000-4000-8000-000000000000', 'Fixture Watchlist', 'private');

insert into public.watchlist_items(watchlist_id, title_id, added_by) values
  ('d0000000-0000-4001-8000-000000000000', 'a0000000-0000-4002-8000-000000000003', 'd0000000-0000-4000-8000-000000000000');
