-- Keep recordings private and preserve the existing audio MIME allowlist.
update storage.buckets
set allowed_mime_types = array(select distinct unnest(coalesce(allowed_mime_types, array[]::text[]) || array['video/mp4']::text[]))
where id = 'call-audio';
