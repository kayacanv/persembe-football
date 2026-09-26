-- Stat averages on the card and profile (plan-ratings.md).
--
-- Adds the six card stats to player_ratings: each is the trimmed mean of the
-- votes, rounded (60-99). Like the position ratings they stay NULL until
-- MIN_VOTERS have voted. Teamwork and work rate are voted but not shown, so
-- they are not stored here. Recomputed by app/actions/rating-actions.ts.

alter table public.player_ratings
  add column if not exists pac smallint check (pac between 60 and 99),
  add column if not exists sho smallint check (sho between 60 and 99),
  add column if not exists pas smallint check (pas between 60 and 99),
  add column if not exists dri smallint check (dri between 60 and 99),
  add column if not exists def smallint check (def between 60 and 99),
  add column if not exists phy smallint check (phy between 60 and 99);
