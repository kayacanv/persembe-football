-- add-jersey-number.sql
-- Adds an editable squad/shirt number to each player, shown on the FIFA-style card
-- next to the overall rating. Cosmetic and independent of power / team balancing.
--
-- Apply by hand (this repo has no migration framework; it follows the add-*.sql convention):
--   supabase db query --linked --experimental --file add-jersey-number.sql
--
-- Nullable on purpose: not every player picks a number. Range 1-99 (NULL = none).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS jersey_number smallint
  CHECK (jersey_number IS NULL OR jersey_number BETWEEN 1 AND 99);
