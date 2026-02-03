-- Add image_urls column to propositions (array of {url, caption} objects)
alter table public.propositions
add column if not exists image_urls jsonb default '[]'::jsonb;

-- RLS for storage.objects: create bucket "proposition-images" in Dashboard first (public, 5MB, image/*)
drop policy if exists "Authenticated users can upload proposition images" on storage.objects;
create policy "Authenticated users can upload proposition images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'proposition-images');

drop policy if exists "Public read for proposition images" on storage.objects;
create policy "Public read for proposition images"
on storage.objects
for select
to public
using (bucket_id = 'proposition-images');
