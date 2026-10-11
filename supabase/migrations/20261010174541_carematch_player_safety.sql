begin;
alter table public.carematch_rounds add column player_hash text check (player_hash ~ '^[a-f0-9]{64}$'), add column terms_version text;
create index carematch_rounds_player_idx on public.carematch_rounds(player_hash) where player_hash is not null;
create table public.carematch_reports (
  id uuid primary key default gen_random_uuid(), alias text not null check(char_length(alias) between 1 and 12),
  reason text not null check (reason in ('Offensive alias','Harassment or hate','Impersonation','Suspected cheating','Other safety concern')),
  reporter_hash text check (reporter_hash ~ '^[a-f0-9]{64}$'), ip_hash text check (ip_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(), reviewed_at timestamptz, moderator_note text check (char_length(moderator_note) <= 500)
);
create index carematch_reports_open_idx on public.carematch_reports(created_at) where status='open';
create index carematch_reports_rate_idx on public.carematch_reports(ip_hash,created_at);
create table public.carematch_alias_bans (alias text primary key check(char_length(alias) between 1 and 12), reason text not null check(char_length(reason) between 1 and 500), created_at timestamptz not null default now());
alter table public.carematch_reports enable row level security;
alter table public.carematch_alias_bans enable row level security;
revoke all on public.carematch_reports, public.carematch_alias_bans from public, anon, authenticated;
grant select,insert,update,delete on public.carematch_reports,public.carematch_alias_bans to service_role;
create policy carematch_reports_server_only on public.carematch_reports for all to service_role using(true) with check(true);
create policy carematch_bans_server_only on public.carematch_alias_bans for all to service_role using(true) with check(true);

create function public.carematch_start_round(p_alias text,p_seed bigint,p_token_hash text,p_ip_hash text,p_player_hash text,p_terms_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if p_player_hash is null or p_player_hash !~ '^[a-f0-9]{64}$' or p_terms_version is distinct from '2026-10-11' then raise exception 'carematch_invalid_consent'; end if;
  if exists(select 1 from public.carematch_alias_bans where alias=p_alias) then raise exception 'carematch_alias_banned'; end if;
  v_result := public.carematch_start_round(p_alias,p_seed,p_token_hash,p_ip_hash);
  update public.carematch_rounds set player_hash=p_player_hash, terms_version=p_terms_version where id=(v_result->>'id')::uuid;
  return v_result;
end; $$;

-- Both legacy and current submissions are checked against current moderation decisions.
create or replace function public.carematch_get_round(p_id uuid,p_token_hash text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('seed',r.seed,'alias',r.alias) from public.carematch_rounds r
  where r.id=p_id and r.token_hash=p_token_hash and r.expires_at>now()
  and not exists(select 1 from public.carematch_alias_bans b where b.alias=r.alias);
$$;
create or replace function public.carematch_save_score(p_id uuid,p_token_hash text,p_score integer,p_supported integer,p_moves integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_round public.carematch_rounds; v_score public.carematch_scores;
begin
  select * into v_round from public.carematch_rounds where id=p_id and token_hash=p_token_hash and expires_at>now() for update;
  if not found then return null; end if;
  if exists(select 1 from public.carematch_alias_bans where alias=v_round.alias) then return null; end if;
  insert into public.carematch_scores(round_id,alias,score,supported,moves) values(v_round.id,v_round.alias,p_score,p_supported,p_moves) on conflict(round_id) do nothing;
  select * into v_score from public.carematch_scores where round_id=p_id;
  return jsonb_build_object('score',v_score.score,'alias',v_score.alias);
end; $$;

create function public.carematch_rankings(p_excluded text[])
returns jsonb language sql stable security invoker set search_path='' as $$
with boundary as (select date_trunc('week',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila' as start_at),
visible as (select s.* from public.carematch_scores s where not(s.alias=any(coalesce(p_excluded,'{}'::text[]))) and not exists(select 1 from public.carematch_alias_bans b where b.alias=s.alias)),
weekly as (select * from (select distinct on(alias) alias,score,submitted_at,round_id from visible,boundary where submitted_at>=start_at order by alias,score desc,submitted_at,round_id) best order by score desc,submitted_at,round_id limit 5),
all_time as (select * from (select distinct on(alias) alias,score,submitted_at,round_id from visible order by alias,score desc,submitted_at,round_id) best order by score desc,submitted_at,round_id limit 5)
select jsonb_build_object('weekly',coalesce((select jsonb_agg(jsonb_build_object('name',alias,'score',score) order by score desc,submitted_at,round_id) from weekly),'[]'::jsonb),
'allTime',coalesce((select jsonb_agg(jsonb_build_object('name',alias,'score',score) order by score desc,submitted_at,round_id) from all_time),'[]'::jsonb),
'weekStart',start_at,'weekEnd',start_at+interval '7 days','timezone','Asia/Manila') from boundary;
$$;
create or replace function public.carematch_rankings() returns jsonb language sql stable security invoker set search_path='' as $$select public.carematch_rankings('{}'::text[]);$$;

create function public.carematch_report_alias(p_alias text,p_reason text,p_reporter_hash text,p_ip_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if p_reporter_hash is null or p_ip_hash is null then raise exception 'carematch_invalid_report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,7));
  if (select count(*) from public.carematch_reports where (ip_hash=p_ip_hash or reporter_hash=p_reporter_hash) and created_at>now()-interval '1 hour')>=10 then raise exception 'carematch_report_limit'; end if;
  select id into v_id from public.carematch_reports where alias=p_alias and reporter_hash=p_reporter_hash and reason=p_reason and status='open';
  if v_id is null then insert into public.carematch_reports(alias,reason,reporter_hash,ip_hash) values(p_alias,p_reason,p_reporter_hash,p_ip_hash) returning id into v_id; end if;
  return jsonb_build_object('id',v_id);
end; $$;
create function public.carematch_delete_device(p_player_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_rounds integer; v_reports integer;
begin
  if p_player_hash is null or p_player_hash !~ '^[a-f0-9]{64}$' then raise exception 'carematch_invalid_device'; end if;
  delete from public.carematch_rounds where player_hash=p_player_hash; get diagnostics v_rounds=row_count;
  delete from public.carematch_reports where reporter_hash=p_player_hash; get diagnostics v_reports=row_count;
  return jsonb_build_object('roundsRemoved',v_rounds,'reportsRemoved',v_reports);
end; $$;

-- Dashboard/service-role only: never exposed through the public game handler.
create function public.carematch_moderate_alias(p_alias text,p_action text,p_note text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_action not in ('ban','unban','dismiss') or p_note is null or char_length(p_note) not between 1 and 500 then raise exception 'carematch_invalid_moderation'; end if;
  if p_action='ban' then insert into public.carematch_alias_bans(alias,reason) values(upper(trim(p_alias)),p_note) on conflict(alias) do update set reason=excluded.reason;
  elsif p_action='unban' then delete from public.carematch_alias_bans where alias=upper(trim(p_alias)); end if;
  update public.carematch_reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,reviewed_at=now(),moderator_note=p_note where alias=upper(trim(p_alias)) and status='open';
  return jsonb_build_object('updated',true);
end; $$;
create function public.carematch_cleanup()
returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.carematch_rounds r where expires_at<now() and not exists(select 1 from public.carematch_scores s where s.round_id=r.id);
  update public.carematch_rounds set ip_hash=null where ip_hash is not null and created_at<now()-interval '24 hours';
  update public.carematch_reports set ip_hash=null where ip_hash is not null and created_at<now()-interval '24 hours';
  delete from public.carematch_reports where status<>'open' and reviewed_at<now()-interval '90 days';
end; $$;
revoke all on function public.carematch_start_round(text,bigint,text,text,text,text), public.carematch_rankings(text[]),public.carematch_report_alias(text,text,text,text),public.carematch_delete_device(text),public.carematch_moderate_alias(text,text,text),public.carematch_cleanup() from public,anon,authenticated;
grant execute on function public.carematch_start_round(text,bigint,text,text,text,text),public.carematch_rankings(text[]),public.carematch_report_alias(text,text,text,text),public.carematch_delete_device(text),public.carematch_moderate_alias(text,text,text),public.carematch_cleanup() to service_role;
create extension if not exists pg_cron;
select cron.schedule('carematch-hourly-privacy-cleanup','17 * * * *','select public.carematch_cleanup();');
notify pgrst,'reload schema';
commit;
