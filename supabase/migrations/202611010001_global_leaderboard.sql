create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint players_username_format check (username::text ~ '^[A-Za-z0-9_]{3,20}$')
);

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_name text;
begin
  loop
    generated_name := 'Party_' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      insert into public.players (id, username) values (new.id, generated_name);
      exit;
    exception when unique_violation then
      if exists (select 1 from public.players where id = new.id) then return new; end if;
    end;
  end loop;
  return new;
end;
$$;

create trigger on_auth_user_created_block_party
  after insert on auth.users
  for each row execute function public.create_player_profile();

create table public.game_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  seed bigint not null check (seed between 0 and 4294967295),
  ruleset_version smallint not null check (ruleset_version = 1),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  idempotency_key uuid,
  payload_hash text,
  score_entry_id uuid,
  check ((submitted_at is null and idempotency_key is null and payload_hash is null and score_entry_id is null)
      or (submitted_at is not null and idempotency_key is not null and payload_hash is not null and score_entry_id is not null))
);
create index game_sessions_player_created_idx on public.game_sessions (player_id, created_at desc);

create or replace function public.create_ranked_session(p_player_id uuid, p_seed bigint, p_ruleset_version smallint, p_expires_at timestamptz)
returns table(session_id uuid, seed bigint, ruleset_version smallint, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  created_session public.game_sessions%rowtype;
begin
  perform 1 from public.players where id = p_player_id for update;
  if not found then raise exception 'player_not_found' using errcode = 'P0002'; end if;
  select count(*) into recent_count from public.game_sessions
    where player_id = p_player_id and created_at > now() - interval '10 minutes';
  if recent_count >= 5 then raise exception 'session_rate_limit' using errcode = '22023'; end if;
  insert into public.game_sessions (player_id, seed, ruleset_version, expires_at)
    values (p_player_id, p_seed, p_ruleset_version, p_expires_at)
    returning * into created_session;
  return query select created_session.id, created_session.seed, created_session.ruleset_version, created_session.expires_at;
end;
$$;

create table public.leaderboard_scores (
  id uuid primary key default extensions.gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  session_id uuid not null unique references public.game_sessions(id) on delete restrict,
  score integer not null check (score between 0 and 2000000000),
  lines integer not null check (lines between 0 and 1000000),
  moves integer not null check (moves between 1 and 5000),
  ruleset_version smallint not null check (ruleset_version = 1),
  verified_at timestamptz not null default now(),
  unique (player_id, session_id)
);
create index leaderboard_scores_ranking_idx on public.leaderboard_scores (score desc, verified_at asc, player_id asc);
create index leaderboard_scores_player_best_idx on public.leaderboard_scores (player_id, score desc, verified_at asc);

alter table public.game_sessions
  add constraint game_sessions_score_entry_fk foreign key (score_entry_id) references public.leaderboard_scores(id) on delete restrict;

-- One highest verified result per player; ties keep their earliest accepted record.
create view public.player_best_scores
with (security_invoker = true)
as
select distinct on (s.player_id)
  s.player_id, p.username, s.score, s.lines, s.moves, s.verified_at, s.id as score_id
from public.leaderboard_scores s
join public.players p on p.id = s.player_id
order by s.player_id, s.score desc, s.verified_at asc, s.id asc;

alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.leaderboard_scores enable row level security;
revoke all on public.players, public.game_sessions, public.leaderboard_scores, public.player_best_scores from public, anon, authenticated;
grant all on public.players, public.game_sessions, public.leaderboard_scores to service_role;
grant select on public.player_best_scores to service_role;
-- No client table-write policies. Edge Functions use the service role after auth and replay checks.

create or replace function public.rename_player(p_player_id uuid, p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare normalized text := btrim(p_username);
begin
  if normalized !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'invalid_username' using errcode = '22023'; end if;
  update public.players set username = normalized, username_changed_at = now()
  where id = p_player_id and (username_changed_at is null or username_changed_at < now() - interval '24 hours')
  returning username::text into normalized;
  if normalized is null then
    if exists (select 1 from public.players where id = p_player_id and username::text = btrim(p_username)) then
      raise exception 'username_cooldown' using errcode = '22023';
    end if;
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;
  return normalized;
end;
$$;

create or replace function public.accept_verified_score(
  p_player_id uuid,
  p_session_id uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_score integer,
  p_lines integer,
  p_moves integer,
  p_ruleset_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare s public.game_sessions%rowtype; inserted public.leaderboard_scores%rowtype;
begin
  select * into s from public.game_sessions where id = p_session_id for update;
  if not found or s.player_id <> p_player_id then raise exception 'invalid_session' using errcode = 'P0002'; end if;
  if s.submitted_at is not null then
    if s.idempotency_key = p_idempotency_key and s.payload_hash = p_payload_hash then
      select * into inserted from public.leaderboard_scores where id = s.score_entry_id;
      return jsonb_build_object('duplicate', true, 'entry_id', inserted.id, 'score', inserted.score);
    end if;
    raise exception 'session_already_submitted' using errcode = '23505';
  end if;
  if s.expires_at <= now() or s.ruleset_version <> p_ruleset_version then raise exception 'expired_or_unsupported_session' using errcode = '22023'; end if;
  insert into public.leaderboard_scores (player_id, session_id, score, lines, moves, ruleset_version)
  values (p_player_id, p_session_id, p_score, p_lines, p_moves, p_ruleset_version)
  returning * into inserted;
  update public.game_sessions set submitted_at = now(), idempotency_key = p_idempotency_key,
    payload_hash = p_payload_hash, score_entry_id = inserted.id where id = p_session_id;
  return jsonb_build_object('duplicate', false, 'entry_id', inserted.id, 'score', inserted.score);
end;
$$;

create or replace function public.global_leaderboard_page(
  p_player_id uuid,
  p_cursor_score integer default null,
  p_cursor_verified_at timestamptz default null,
  p_cursor_player_id uuid default null,
  p_page_size integer default 50
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (s.player_id) s.player_id, p.username::text as username, s.score, s.verified_at
    from public.leaderboard_scores s join public.players p on p.id = s.player_id
    order by s.player_id, s.score desc, s.verified_at asc, s.id asc
  ), ranked as (
    select b.*, row_number() over (order by score desc, verified_at asc, player_id asc)::bigint as rank
    from best b
  ), after_cursor as (
    select * from ranked r
    where p_cursor_score is null or r.score < p_cursor_score
      or (r.score = p_cursor_score and r.verified_at > p_cursor_verified_at)
      or (r.score = p_cursor_score and r.verified_at = p_cursor_verified_at and r.player_id > p_cursor_player_id)
  ), page as (
    select * from after_cursor order by score desc, verified_at asc, player_id asc limit least(greatest(p_page_size, 1), 50)
  )
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(jsonb_build_object('player_id', player_id, 'username', username, 'score', score, 'verified_at', verified_at, 'rank', rank) order by rank) from page), '[]'::jsonb),
    'top_three', coalesce((select jsonb_agg(jsonb_build_object('player_id', player_id, 'username', username, 'score', score, 'verified_at', verified_at, 'rank', rank) order by rank) from ranked where rank <= 3), '[]'::jsonb),
    'my_rank', (select rank from ranked where player_id = p_player_id),
    'my_entry', (select jsonb_build_object('player_id', player_id, 'username', username, 'score', score, 'verified_at', verified_at, 'rank', rank) from ranked where player_id = p_player_id),
    'next_cursor', (select jsonb_build_object('score', score, 'verified_at', verified_at, 'player_id', player_id) from page order by rank desc limit 1),
    'has_more', (select count(*) > least(greatest(p_page_size, 1), 50) from after_cursor)
  );
$$;

create or replace function public.search_global_leaderboard(p_query text, p_limit integer default 20)
returns table(player_id uuid, username text, score integer, verified_at timestamptz, rank bigint)
language sql
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (s.player_id) s.player_id, p.username::text as username, s.score, s.verified_at
    from public.leaderboard_scores s join public.players p on p.id = s.player_id
    order by s.player_id, s.score desc, s.verified_at asc, s.id asc
  ), ranked as (
    select b.*, row_number() over (order by score desc, verified_at asc, player_id asc)::bigint as rank from best b
  )
  select r.player_id, r.username, r.score, r.verified_at, r.rank from ranked r
  where strpos(lower(r.username), lower(btrim(p_query))) > 0
  order by r.rank limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.rename_player(uuid, text) from public, anon, authenticated;
revoke all on function public.create_ranked_session(uuid, bigint, smallint, timestamptz) from public, anon, authenticated;
revoke all on function public.accept_verified_score(uuid, uuid, uuid, text, integer, integer, integer, smallint) from public, anon, authenticated;
revoke all on function public.global_leaderboard_page(uuid, integer, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.search_global_leaderboard(text, integer) from public, anon, authenticated;
revoke all on function public.create_player_profile() from public, anon, authenticated;
grant execute on function public.rename_player(uuid, text) to service_role;
grant execute on function public.create_ranked_session(uuid, bigint, smallint, timestamptz) to service_role;
grant execute on function public.accept_verified_score(uuid, uuid, uuid, text, integer, integer, integer, smallint) to service_role;
grant execute on function public.global_leaderboard_page(uuid, integer, timestamptz, uuid, integer) to service_role;
grant execute on function public.search_global_leaderboard(text, integer) to service_role;

create or replace function public.broadcast_verified_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes('global-leaderboard', 'INSERT', TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  return null;
end;
$$;
create trigger on_verified_leaderboard_score_insert
  after insert on public.leaderboard_scores
  for each row execute function public.broadcast_verified_score();
revoke all on function public.broadcast_verified_score() from public, anon, authenticated;

create policy "Authenticated players can receive global ranking broadcasts"
  on realtime.messages for select to authenticated
  using (extension = 'broadcast' and topic = 'global-leaderboard');
