begin;

create table public.carematch_rounds (
  id uuid primary key default gen_random_uuid(),
  alias text not null check (char_length(alias) between 1 and 12),
  seed bigint not null check (seed between 0 and 4294967295),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text check (ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index carematch_rounds_ip_created_idx on public.carematch_rounds(ip_hash, created_at);
create index carematch_rounds_expires_idx on public.carematch_rounds(expires_at);

create table public.carematch_scores (
  round_id uuid primary key references public.carematch_rounds(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 12),
  score integer not null check (score between 0 and 1000000),
  supported integer not null check (supported between 0 and 200),
  moves integer not null check (moves between 0 and 60),
  rules_version integer not null default 1 check (rules_version = 1),
  submitted_at timestamptz not null default now()
);
create index carematch_scores_alias_best_idx on public.carematch_scores(alias, score desc, submitted_at, round_id);
create index carematch_scores_submitted_idx on public.carematch_scores(submitted_at);

alter table public.carematch_rounds enable row level security;
alter table public.carematch_scores enable row level security;
revoke all on public.carematch_rounds, public.carematch_scores from public, anon, authenticated;
grant select, insert, update, delete on public.carematch_rounds to service_role;
grant select, insert, delete on public.carematch_scores to service_role;
create policy carematch_rounds_server_only on public.carematch_rounds for all to service_role using (true) with check (true);
create policy carematch_scores_server_only on public.carematch_scores for all to service_role using (true) with check (true);

create function public.carematch_start_round(p_alias text, p_seed bigint, p_token_hash text, p_ip_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_round public.carematch_rounds;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));
  if (select count(*) from public.carematch_rounds where ip_hash = p_ip_hash and created_at > now() - interval '1 minute') >= 10
    or (select count(*) from public.carematch_rounds where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 200 then
    raise exception 'carematch_rate_limit';
  end if;
  -- Only CareMatch records are cleaned; valid scores remain for the all-time board.
  delete from public.carematch_rounds r where r.expires_at < now()
    and not exists (select 1 from public.carematch_scores s where s.round_id = r.id);
  update public.carematch_rounds set ip_hash = null where ip_hash is not null and created_at < now() - interval '24 hours';
  insert into public.carematch_rounds(alias, seed, token_hash, ip_hash)
    values(p_alias, p_seed, p_token_hash, p_ip_hash) returning * into v_round;
  return jsonb_build_object('id', v_round.id, 'expiresAt', v_round.expires_at);
end;
$$;

create function public.carematch_get_round(p_id uuid, p_token_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('seed', r.seed, 'alias', r.alias)
  from public.carematch_rounds r
  where r.id = p_id and r.token_hash = p_token_hash and r.expires_at > now();
$$;

create function public.carematch_save_score(p_id uuid, p_token_hash text, p_score integer, p_supported integer, p_moves integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_round public.carematch_rounds; v_score public.carematch_scores;
begin
  select * into v_round from public.carematch_rounds
    where id = p_id and token_hash = p_token_hash and expires_at > now() for update;
  if not found then return null; end if;
  insert into public.carematch_scores(round_id, alias, score, supported, moves)
    values(v_round.id, v_round.alias, p_score, p_supported, p_moves)
    on conflict (round_id) do nothing;
  select * into v_score from public.carematch_scores where round_id = p_id;
  return jsonb_build_object('score', v_score.score, 'alias', v_score.alias);
end;
$$;

create function public.carematch_rankings()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with boundary as (
    select date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila' as start_at
  ), weekly as (
    select * from (
      select distinct on (alias) alias, score, submitted_at, round_id
      from public.carematch_scores, boundary where submitted_at >= start_at
      order by alias, score desc, submitted_at, round_id
    ) best order by score desc, submitted_at, round_id limit 5
  ), all_time as (
    select * from (
      select distinct on (alias) alias, score, submitted_at, round_id
      from public.carematch_scores order by alias, score desc, submitted_at, round_id
    ) best order by score desc, submitted_at, round_id limit 5
  )
  select jsonb_build_object(
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('name', alias, 'score', score) order by score desc, submitted_at, round_id) from weekly), '[]'::jsonb),
    'allTime', coalesce((select jsonb_agg(jsonb_build_object('name', alias, 'score', score) order by score desc, submitted_at, round_id) from all_time), '[]'::jsonb),
    'weekStart', start_at, 'weekEnd', start_at + interval '7 days', 'timezone', 'Asia/Manila'
  ) from boundary;
$$;

revoke all on function public.carematch_start_round(text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.carematch_get_round(uuid,text) from public, anon, authenticated;
revoke all on function public.carematch_save_score(uuid,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.carematch_rankings() from public, anon, authenticated;
grant execute on function public.carematch_start_round(text,bigint,text,text) to service_role;
grant execute on function public.carematch_get_round(uuid,text) to service_role;
grant execute on function public.carematch_save_score(uuid,text,integer,integer,integer) to service_role;
grant execute on function public.carematch_rankings() to service_role;
notify pgrst, 'reload schema';
commit;
