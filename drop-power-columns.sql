-- Retire the old strength model. Team building reads the FIFA card through
-- app/lib/rating.ts, and neither the app nor wa-bot writes these any more.
alter table public.users
  drop column if exists power,
  drop column if exists position_weight;
