-- MVP (man of the match) voting.
-- One vote per device per match; the unique constraint is the real guard,
-- localStorage is only the UX guard (no auth in this app).
create table if not exists mvp_votes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  candidate_id uuid not null references users(id)   on delete cascade,
  device_id    text not null,
  created_at   timestamptz not null default now(),
  unique (match_id, device_id)
);

create index if not exists mvp_votes_match_id_idx on mvp_votes (match_id);

alter table mvp_votes enable row level security;

-- Match the app's anon-key access model (same as the other tables).
create policy "mvp_votes anon read"   on mvp_votes for select using (true);
create policy "mvp_votes anon insert" on mvp_votes for insert with check (true);
