-- add-field-coordinates.sql
-- Persists the exact on-pitch spot of each player in the Organize Teams page, so a
-- free-form formation (any number of players per line, symmetric layout, CDM/CAM lines)
-- reloads identically for everyone who opens the match.
--
-- Apply by hand:
--   supabase db query --linked --experimental --file add-field-coordinates.sql
--
-- field_x / field_y are normalized percentages (0-100) of the team's pitch, measured
-- left->right (x) and top->bottom (y, forward line at the top). NULL = not placed yet.
-- The legacy `position` integer (1-9 slot index) is still written for backward compat,
-- but field_x/field_y are the source of truth for layout when present.

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS field_x numeric CHECK (field_x IS NULL OR field_x BETWEEN 0 AND 100);

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS field_y numeric CHECK (field_y IS NULL OR field_y BETWEEN 0 AND 100);
