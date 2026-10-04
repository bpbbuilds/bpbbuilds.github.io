-- Cool Shades is a Founding-only cosmetic. Keep the existing published row
-- public in the catalog, but require a Founding entitlement to equip it.
update public.cosmetic_drops
set "grant" = 'founding',
    starter = false
where id = 'cool_shades';

notify pgrst, 'reload schema';
