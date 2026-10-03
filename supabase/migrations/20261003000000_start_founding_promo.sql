-- Start the founding promo gate
-- Run this to enable first 10 eligible Discord sign-ins to get Premium forever
-- After running: update founding_promo set started_at = now() where id = true;

update public.founding_promo
set started_at = now()
where id = true;