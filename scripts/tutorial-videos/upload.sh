#!/bin/bash
# Upload recorded tutorial videos + thumbnails to Supabase Storage and point
# public.tutorials at them. Usage: bash upload.sh [id ...]   (default: all mp4s in out/)
set -e
SRK="${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
URL="${SUPABASE_URL:?set SUPABASE_URL}"
OUT="${OUT_DIR:-/tmp/tut/out}"
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then
  for f in "$OUT"/*.mp4; do ids+=("$(basename "$f" .mp4)"); done
fi
for id in "${ids[@]}"; do
  mp4="$OUT/$id.mp4"; jpg="$OUT/$id.jpg"
  [ -f "$mp4" ] || { echo "SKIP $id (no mp4)"; continue; }
  dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$mp4" | cut -d. -f1)
  # upsert objects
  curl -sf -X POST "$URL/storage/v1/object/tutorial-videos/$id.mp4" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    -H "Content-Type: video/mp4" -H "x-upsert: true" \
    --data-binary @"$mp4" > /dev/null
  curl -sf -X POST "$URL/storage/v1/object/tutorial-videos/$id.jpg" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    -H "Content-Type: image/jpeg" -H "x-upsert: true" \
    --data-binary @"$jpg" > /dev/null
  v="$URL/storage/v1/object/public/tutorial-videos/$id.mp4"
  t="$URL/storage/v1/object/public/tutorial-videos/$id.jpg"
  curl -sf -X PATCH "$URL/rest/v1/tutorials?id=eq.$id" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
    -d "{\"video_url\":\"$v\",\"video_thumbnail_url\":\"$t\",\"video_provider\":\"playwright\",\"video_model\":\"screen-recording\",\"video_job_id\":null,\"video_duration_seconds\":$dur,\"video_status\":\"completed\",\"video_error\":null,\"video_generated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /dev/null
  echo "UPLOADED $id (${dur}s, $(du -h "$mp4" | cut -f1))"
done