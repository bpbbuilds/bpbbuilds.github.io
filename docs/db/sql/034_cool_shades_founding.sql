-- Cool Shades is a Founding-only cosmetic while remaining visible in the
-- published catalog.
update public.cosmetic_drops
set "grant" = 'founding',
    starter = false
where id = 'cool_shades';
