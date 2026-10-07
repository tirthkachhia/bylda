-- Keep the private recording bucket aligned with the upload form.
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'call-audio';
