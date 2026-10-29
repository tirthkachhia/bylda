import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playbackSeekSeconds } from "@/lib/coaching/source-navigation";
import { formatDuration } from "@/lib/coaching/calls";
export function CallRecording({
  path,
  recordingUrl = null,
  seekSeconds,
  seekRequest = 0,
}: {
  path: string | null;
  recordingUrl?: string | null;
  seekSeconds: number | null;
  seekRequest?: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState<number | null>(null),
    [failed, setFailed] = useState(false),
    [speed, setSpeed] = useState(1);
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
  let direct: string | null = null;
  try {
    if (recordingUrl && new URL(recordingUrl).protocol === "https:") direct = recordingUrl;
  } catch {
    /* Invalid provider recording reference. */
  }
  const src = path ? q.data : direct;
  const play = useCallback(() => {
    void audio.current?.play().catch(() => setPlaying(false));
  }, []);
  const seek = useCallback(() => {
    const player = audio.current;
    if (!player?.readyState) return;
    const at = playbackSeekSeconds(
      seekSeconds,
      Number.isFinite(player.duration) ? player.duration : null,
    );
    if (at === null) return;
    player.currentTime = at;
    setCurrent(at);
    play();
  }, [seekSeconds, play]);
  useEffect(seek, [seek, seekRequest, src]);
  const move = (seconds: number) => {
    const player = audio.current;
    if (!player?.readyState) return;
    const at = playbackSeekSeconds(
      seconds,
      Number.isFinite(player.duration) ? player.duration : null,
    );
    if (at !== null) {
      player.currentTime = at;
      setCurrent(at);
    }
  };
  return (
    <section
      className="rounded-xl border border-by-border-engraved bg-by-surface-hover px-4 py-3"
      aria-label="Call recording"
    >
      {src && !failed ? (
        <>
          <audio
            ref={audio}
            src={src}
            preload="metadata"
            onLoadedMetadata={() => {
              setDuration(
                Number.isFinite(audio.current?.duration) ? audio.current!.duration : null,
              );
              seek();
            }}
            onTimeUpdate={() => setCurrent(audio.current?.currentTime ?? 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label={playing ? "Pause recording" : "Play recording"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-by-surface-control-dark text-white"
              onClick={() => {
                if (playing) audio.current?.pause();
                else play();
              }}
            >
              {playing ? <Pause size={14} /> : <img src="/figma/play.svg" alt="" />}
            </button>
            <span className="font-mono text-[11px] tabular-nums">
              {formatDuration(current)} / {formatDuration(duration)}
            </span>
            <input
              type="range"
              aria-label="Recording position"
              min={0}
              max={duration ?? 0}
              value={Math.min(current, duration ?? 0)}
              step={0.1}
              disabled={!duration}
              onChange={(event) => move(Number(event.target.value))}
              className="min-w-24 flex-1 accent-by-surface-control-dark"
            />
            <label className="text-xs">
              <span className="sr-only">Playback speed</span>
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSpeed(value);
                  if (audio.current) audio.current.playbackRate = value;
                }}
                className="bg-transparent p-1"
              >
                {[1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="Back ten seconds"
              className="text-xs"
              onClick={() => move(current - 10 < 0 ? 0 : current - 10)}
            >
              −10s
            </button>
            <button
              type="button"
              aria-label="Forward ten seconds"
              className="text-xs"
              onClick={() => move(current + 10)}
            >
              +10s
            </button>
          </div>
        </>
      ) : (
        <p role="status" className="text-xs text-by-text-secondary">
          {failed || q.error
            ? "Recording could not be loaded. You can still review transcript evidence."
            : !path && !direct
              ? "Recording unavailable; timestamp links open the transcript."
              : "Loading recording…"}
          {path && (q.error || failed) && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setFailed(false);
                void q.refetch();
              }}
            >
              Retry
            </button>
          )}
        </p>
      )}
    </section>
  );
}
