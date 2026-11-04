begin;
create extension if not exists pgtap with schema extensions;

select extensions.plan(12);
select extensions.has_table('public', 'players', 'player profiles table exists');
select extensions.ok((
  select exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where n.nspname = 'public' and t.relname = 'players' and a.attname = 'username' and c.contype = 'u'
  )
), 'usernames have a database uniqueness constraint');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.leaderboard_scores'::regclass), 'verified scores have RLS enabled');

insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb);

select extensions.throws_ok(
  $$update public.players target
    set username = (select username::text from public.players where id = '11111111-1111-4111-8111-111111111111')
    where target.id = '22222222-2222-4222-8222-222222222222'$$,
  '23505', null, 'case-insensitive duplicate usernames are rejected by PostgreSQL'
);
insert into public.game_sessions (id, player_id, seed, ruleset_version, expires_at)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 123, 1, now() + interval '1 hour');

select extensions.throws_ok(
  $$select public.accept_verified_score('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'foreign-session', 10, 0, 1, 1::smallint)$$,
  'P0002', null, 'a different player cannot submit another player’s session'
);

select extensions.is(
  (public.accept_verified_score('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-v1', 1900000000, 0, 1, 1::smallint)->>'duplicate')::boolean,
  false, 'first accepted score is not a duplicate'
);
select extensions.is(
  (public.accept_verified_score('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hash-v1', 1900000000, 0, 1, 1::smallint)->>'duplicate')::boolean,
  true, 'identical score retries are idempotent'
);
select extensions.throws_ok(
  $$select public.accept_verified_score('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'different-hash', 1900000001, 0, 1, 1::smallint)$$,
  '23505', null, 'a different second submission for the same session is rejected'
);

insert into public.game_sessions (id, player_id, seed, ruleset_version, expires_at)
values ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 456, 1, now() + interval '1 hour');
do $$ begin
  perform public.accept_verified_score('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'hash-v2', 2000000000, 0, 1, 1::smallint);
end $$;

select extensions.is(
  jsonb_array_length(public.global_leaderboard_page(null, null, null, null, 1)->'entries'),
  1, 'keyset request returns exactly the requested page size'
);
with first_page as (select public.global_leaderboard_page(null, null, null, null, 1) as page)
select extensions.is(
  (public.global_leaderboard_page(
    null,
    ((page->'next_cursor'->>'score')::integer),
    ((page->'next_cursor'->>'verified_at')::timestamptz),
    ((page->'next_cursor'->>'player_id')::uuid),
    1
  )->'entries'->0->>'player_id'),
  '11111111-1111-4111-8111-111111111111', 'the next keyset page starts after the previous cursor without an offset'
) from first_page;

insert into public.game_sessions (id, player_id, seed, ruleset_version, expires_at)
values
  ('60000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 1, now() + interval '1 hour'),
  ('60000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 2, 1, now() + interval '1 hour'),
  ('60000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 3, 1, now() + interval '1 hour'),
  ('60000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 4, 1, now() + interval '1 hour');
select extensions.throws_ok(
  $$select public.create_ranked_session('11111111-1111-4111-8111-111111111111', 5, 1::smallint, now() + interval '1 hour')$$,
  '22023', null, 'ranked sessions are rate-limited to five per ten minutes'
);

set local role authenticated;
select extensions.throws_ok(
  $$insert into public.leaderboard_scores (id, player_id, session_id, score, lines, moves, ruleset_version)
    values ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 999999, 0, 1, 1)$$,
  '42501', null, 'authenticated clients cannot insert verified leaderboard rows'
);
reset role;

select * from extensions.finish();
rollback;
