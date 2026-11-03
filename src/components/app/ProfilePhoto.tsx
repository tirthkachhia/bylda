import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
export function ProfilePhoto() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photo = (profile as { avatar_url?: string | null } | null)?.avatar_url;
  async function save(file: File) {
    if (!user) return;
    setBusy(true);
    setError("");
    let url = "";
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose PNG, JPEG or WebP up to 5 MB.");
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Photo processing is not supported by this browser.");
      const edge = Math.min(image.width, image.height);
      ctx.drawImage(
        image,
        (image.width - edge) / 2,
        (image.height - edge) / 2,
        edge,
        edge,
        0,
        0,
        128,
        128,
      );
      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: canvas.toDataURL("image/jpeg", 0.85) })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Photo could not be saved.");
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo could not save.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {photo && (
        <img src={photo} alt="Your profile" className="size-14 rounded-full object-cover" />
      )}
      <label className="figma-button">
        {busy ? "Saving photo…" : "Change photo"}
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void save(file);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
