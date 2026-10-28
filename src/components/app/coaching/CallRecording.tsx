import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CallRecording({
  path,
  seekSeconds,
}: {
  path: string | null;
  seekSeconds: number | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const q = useQuery({
    queryKey: ["call-recording", path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("call-audio")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const seek = () => {
    const player = audio.current;
    if (
      !player ||
      seekSeconds === null ||
      !Number.isFinite(seekSeconds) ||
      seekSeconds < 0 ||
      !player.readyState
    )
      return;
    player.currentTime = Number.isFinite(player.duration)
      ? Math.min(seekSeconds, Math.max(0, player.duration - 0.01))
      : seekSeconds;
    void player.play().catch(() => {
      /* Browser may require the user to press Play. */
    });
  };
  useEffect(seek, [seekSeconds, q.data]);
  return (
    <section className="rounded border bg-white p-3" aria-label="Call recording">
      {q.data ? (
        <audio
          ref={audio}
          src={q.data}
          controls
          preload="metadata"
          onLoadedMetadata={seek}
          className="w-full"
        />
      ) : (
        <p className="text-xs text-neutral-500">
          {!path
            ? "Recording unavailable; timestamp links open the transcript."
            : q.error
              ? "Recording could not be loaded. You can still review transcript evidence."
              : "Loading recording…"}
        </p>
      )}
    </section>
  );
}
