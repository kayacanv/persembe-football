-- Players flagged `auto_paid` never owe a pitch fee: they are the ones who
-- collect it. Their match_players rows are forced to has_paid = true on write,
-- so the unpaid list stops reporting the organiser against himself.

alter table public.users
  add column if not exists auto_paid boolean not null default false;

comment on column public.users.auto_paid is
  'Fee collector: registrations are auto-marked paid (see trg_match_players_auto_paid).';

create or replace function public.match_players_apply_auto_paid()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.users u where u.id = new.user_id and u.auto_paid) then
    new.has_paid := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_match_players_auto_paid on public.match_players;
create trigger trg_match_players_auto_paid
  before insert or update on public.match_players
  for each row execute function public.match_players_apply_auto_paid();

-- Kayacan (username 'kayacan') collects the money.
update public.users set auto_paid = true where username = 'kayacan';

-- Backfill every past registration of his.
update public.match_players mp
   set has_paid = true
  from public.users u
 where u.id = mp.user_id and u.auto_paid and not mp.has_paid;
