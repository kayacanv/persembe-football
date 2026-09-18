-- Starling payer aliases: which bank payer name belongs to which player.
--
-- Learned from every matched payment (automatic or admin-linked), so a player
-- who has paid before no longer needs to type the NAM-DDMM-WXYZ reference: an
-- incoming transfer with no usable reference is matched by payer name + amount
-- + an open registration instead (see app/lib/starling-match.ts).
--
-- Apply manually: supabase db query --linked --file add-payer-aliases.sql
-- (no migration framework here).

-- Same normalisation as normalizeRef() in app/lib/payment-ref.ts: Turkish
-- letters cast to ASCII, uppercased, everything but A-Z0-9 stripped. Keep the
-- two in step — the matcher computes keys in TypeScript, the backfill in SQL.
create or replace function public.payer_key_of(p_name text)
returns text
language sql
immutable
as $$
  select upper(
    regexp_replace(
      translate(coalesce(p_name, ''), 'çÇğĞıİöÖşŞüÜ', 'cCgGiIoOsSuU'),
      '[^A-Za-z0-9]', '', 'g'
    )
  )
$$;

create table if not exists public.payer_aliases (
  id          uuid primary key default gen_random_uuid(),
  payer_key   text not null,                 -- payer_key_of(counterparty_name), e.g. ERDALCETIN
  payer_name  text not null,                 -- last raw spelling, display only
  user_id     uuid not null references public.users(id) on delete cascade,
  match_count integer not null default 1,    -- payments this pair has explained
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  source      text not null default 'auto',  -- auto | manual | backfill
  unique (payer_key, user_id)
);

create index if not exists payer_aliases_key_idx  on public.payer_aliases (payer_key);
create index if not exists payer_aliases_user_idx on public.payer_aliases (user_id);

comment on table public.payer_aliases is
  'Bank payer name -> player, learned from matched Starling payments. Full names: never readable with the anon key.';

-- RLS: NO public select. Payer names are personal data; every read goes through
-- a server action that decides what the caller may see. Service role only.
alter table public.payer_aliases enable row level security;

drop policy if exists payer_aliases_service_all on public.payer_aliases;
create policy payer_aliases_service_all
  on public.payer_aliases for all
  to service_role
  using (true)
  with check (true);

-- Upsert helper used by the matcher and the admin link action (via rpc).
create or replace function public.payer_alias_touch(
  p_key text,
  p_name text,
  p_user_id uuid,
  p_source text default 'auto'
)
returns void
language plpgsql
as $$
begin
  if coalesce(p_key, '') = '' or p_user_id is null then
    return;
  end if;

  insert into public.payer_aliases (payer_key, payer_name, user_id, match_count, first_seen, last_seen, source)
  values (p_key, coalesce(nullif(p_name, ''), p_key), p_user_id, 1, now(), now(), coalesce(p_source, 'auto'))
  on conflict (payer_key, user_id) do update
    set match_count = public.payer_aliases.match_count + 1,
        last_seen   = now(),
        payer_name  = excluded.payer_name;
end;
$$;

-- PostgREST exposes functions to anon by default; only the service role may
-- write aliases.
revoke execute on function public.payer_alias_touch(text, text, uuid, text) from public, anon, authenticated;
grant  execute on function public.payer_alias_touch(text, text, uuid, text) to service_role;

-- bank_payments: record which path matched, allow 'ignored' for our own
-- internal transfers, and stop exposing payer names to the anon key.
alter table public.bank_payments
  add column if not exists match_method text;   -- reference | payer | manual (null = before this migration)

comment on column public.bank_payments.match_status is 'unmatched | matched | campaign | ignored';
comment on column public.bank_payments.match_method is 'reference | payer | manual; null for rows matched before payer aliases existed';

-- Nothing in the browser reads bank_payments (all reads are server-side with
-- the service role), so the public select policy only leaked names.
drop policy if exists bank_payments_read on public.bank_payments;

-- Money moved from our own main account into the space is not a player payment.
update public.bank_payments
   set match_status = 'ignored'
 where direction = 'IN'
   and raw->>'source' = 'INTERNAL_TRANSFER'
   and match_status = 'unmatched';

-- Backfill aliases from everything matched so far.
insert into public.payer_aliases (payer_key, payer_name, user_id, match_count, first_seen, last_seen, source)
select public.payer_key_of(bp.counterparty_name),
       max(bp.counterparty_name),
       mp.user_id,
       count(*),
       min(bp.transaction_time),
       max(bp.transaction_time),
       'backfill'
  from public.bank_payments bp
  join public.match_players mp on mp.id = bp.matched_match_player_id
 where bp.direction = 'IN'
   and bp.match_status = 'matched'
   and coalesce(bp.counterparty_name, '') <> ''
 group by 1, mp.user_id
on conflict (payer_key, user_id) do nothing;
