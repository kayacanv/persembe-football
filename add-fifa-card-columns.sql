-- add-fifa-card-columns.sql
-- Adds in-app, per-player editable FIFA-style card fields to the `users` table.
-- Apply by hand in the Supabase SQL editor (this repo has no migration framework;
-- it follows the existing add-*.sql convention).
--
-- NOTE: the build ignores TS/lint errors, so a wrong column name surfaces only as a
-- runtime Supabase 400. Column names here MUST match app/lib/types.ts and data-service.ts.
--
-- Decisions baked in:
--   * Card stats are COSMETIC and fully independent of `power` / team balancing.
--     We seed from the Turkish `position` field only, around a neutral ~70 base.
--   * card_baked = TRUE for any player who already has a photo_url, because those are
--     legacy fully-baked fut.gg card PNGs. They keep rendering as-is (no card-inside-a-card)
--     until the player opts into the live card.

-- 1) Columns (idempotent) ---------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_overall   smallint NOT NULL DEFAULT 70 CHECK (card_overall BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_pac       smallint NOT NULL DEFAULT 70 CHECK (card_pac BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_sho       smallint NOT NULL DEFAULT 70 CHECK (card_sho BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_pas       smallint NOT NULL DEFAULT 70 CHECK (card_pas BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_dri       smallint NOT NULL DEFAULT 70 CHECK (card_dri BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_def       smallint NOT NULL DEFAULT 60 CHECK (card_def BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_phy       smallint NOT NULL DEFAULT 70 CHECK (card_phy BETWEEN 0 AND 99);
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_position  text     NOT NULL DEFAULT 'CM';
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_nation    text     DEFAULT 'tr';
ALTER TABLE users ADD COLUMN IF NOT EXISTS club_badge_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_tier      text     NOT NULL DEFAULT 'silver';
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_photo_scale numeric NOT NULL DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_photo_x     numeric NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_photo_y     numeric NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_photo_fade  boolean NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_baked       boolean NOT NULL DEFAULT FALSE;

-- 2) One-shot baseline seed so EVERY existing player instantly has a sensible card. ------
--    Re-runnable: it just rewrites the card_* values from the Turkish position. If you have
--    already hand-tuned some cards, DO NOT re-run this block (it would overwrite them).

-- 2a) FIFA position + legacy-baked flag.
UPDATE users SET
  card_baked = (photo_url IS NOT NULL),
  card_position = CASE position
    WHEN 'kaleci'    THEN 'GK'
    WHEN 'defans'    THEN 'CB'
    WHEN 'orta saha' THEN 'CM'
    WHEN 'forvet'    THEN 'ST'
    ELSE 'CM'
  END;

-- 2b) Position-flavored stat spread around a neutral ~70 (NOT derived from power).
UPDATE users SET
  card_overall = 70,
  card_pac = CASE position WHEN 'forvet' THEN 80 WHEN 'orta saha' THEN 72 WHEN 'defans' THEN 66 WHEN 'kaleci' THEN 58 ELSE 70 END,
  card_sho = CASE position WHEN 'forvet' THEN 82 WHEN 'orta saha' THEN 68 WHEN 'defans' THEN 50 WHEN 'kaleci' THEN 35 ELSE 65 END,
  card_pas = CASE position WHEN 'forvet' THEN 68 WHEN 'orta saha' THEN 78 WHEN 'defans' THEN 66 WHEN 'kaleci' THEN 60 ELSE 70 END,
  card_dri = CASE position WHEN 'forvet' THEN 78 WHEN 'orta saha' THEN 76 WHEN 'defans' THEN 60 WHEN 'kaleci' THEN 52 ELSE 70 END,
  card_def = CASE position WHEN 'forvet' THEN 45 WHEN 'orta saha' THEN 64 WHEN 'defans' THEN 80 WHEN 'kaleci' THEN 58 ELSE 60 END,
  card_phy = CASE position WHEN 'forvet' THEN 72 WHEN 'orta saha' THEN 70 WHEN 'defans' THEN 78 WHEN 'kaleci' THEN 70 ELSE 70 END;

-- 2c) Tier from the (currently uniform) overall band. With overall 70 everyone starts 'silver';
--     players can change tier in the editor.
UPDATE users SET card_tier = CASE
  WHEN card_overall >= 75 THEN 'gold'
  WHEN card_overall >= 65 THEN 'silver'
  ELSE 'bronze'
END;
