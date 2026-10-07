insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('call-audio', 'call-audio', false, 26214400,
  array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/flac','audio/x-m4a'])
on conflict (id) do nothing;

create policy "call_audio_member_read" on storage.objects for select to authenticated
using (bucket_id = 'call-audio' and exists (
  select 1 from public.organization_members m
  where m.organization_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
));
create policy "call_audio_member_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'call-audio' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.organization_members m
    where m.organization_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
create policy "call_audio_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'call-audio' and (storage.foldername(name))[2] = auth.uid()::text);
