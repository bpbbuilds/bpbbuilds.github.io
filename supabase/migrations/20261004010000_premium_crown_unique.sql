-- Premium Crown is a Unique cosmetic. Keep the live catalog aligned with the
-- bundled fallback catalog; grants and ownership are unchanged.
update public.cosmetic_drops
set rarity = 'Unique'
where id = 'premium_crown';

notify pgrst, 'reload schema';
