// "Make it yours" — topbar button that opens the 3-color theme palette.
// Base (background), Secondary (buttons & highlights), Text. Presets plus a
// custom color picker per row. Changes apply live and persist.

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, RotateCcw } from "lucide-react";
import {
  applyPalette,
  clearPalette,
  isReadable,
  loadPalette,
  savePalette,
  BASE_PRESETS,
  SECONDARY_PRESETS,
  TEXT_PRESETS,
  type ByldaPalette,
} from "@/lib/theme-palette";

const DEFAULT_PALETTE: ByldaPalette = {
  base: "#ffffff",
  secondary: "#7c3aed",
  text: "#111827",
};

export function ThemePaletteButton() {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState<ByldaPalette>(() => loadPalette() ?? DEFAULT_PALETTE);
  const [customized, setCustomized] = useState(() => loadPalette() !== null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = (key: keyof ByldaPalette, value: string) => {
    const next = { ...palette, [key]: value };
    setPalette(next);
    setCustomized(true);
    applyPalette(next);
    savePalette(next);
  };

  const reset = () => {
    setPalette(DEFAULT_PALETTE);
    setCustomized(false);
    clearPalette();
  };

  const readable = isReadable(palette);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Pick your 3 colors"
        className="inline-flex items-center gap-2 rounded-[4px] border px-2.5 py-1.5 text-[12px] font-semibold"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
        }}
      >
        <LayoutGrid className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
        Theme
        <span className="flex gap-[2px]">
          {([palette.base, palette.secondary, palette.text] as const).map((c, i) => (
            <span
              key={i}
              className="block h-[9px] w-[9px] rounded-[2px]"
              style={{ background: c, border: "1px solid var(--border)" }}
            />
          ))}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[316px] rounded-[6px] border p-4"
          style={{
            background: "var(--popover)",
            borderColor: "var(--border)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.10), 0 24px 48px rgba(0,0,0,0.12)",
          }}
        >
          <div className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
            Make it yours
          </div>
          <div
            className="mt-0.5 text-[12px] leading-snug"
            style={{ color: "var(--muted-foreground)" }}
          >
            Pick any 3 colors. The whole app changes right away.
          </div>

          <PaletteRow
            label="Base"
            hint="background"
            presets={BASE_PRESETS}
            value={palette.base}
            onPick={(c) => pick("base", c)}
          />
          <PaletteRow
            label="Secondary"
            hint="buttons & highlights"
            presets={SECONDARY_PRESETS}
            value={palette.secondary}
            onPick={(c) => pick("secondary", c)}
          />
          <PaletteRow
            label="Text"
            hint="all writing"
            presets={TEXT_PRESETS}
            value={palette.text}
            onPick={(c) => pick("text", c)}
          />

          <div
            className="mt-4 flex items-center justify-between border-t pt-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: readable ? "var(--text-faint)" : "var(--destructive)" }}
            >
              {readable
                ? "These colors are easy to read."
                : "Careful — this text is hard to read on this base."}
            </span>
            {customized && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: "var(--muted-foreground)" }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaletteRow({
  label,
  hint,
  presets,
  value,
  onPick,
}: {
  label: string;
  hint: string;
  presets: string[];
  value: string;
  onPick: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreset = presets.includes(value.toLowerCase()) || presets.includes(value);

  return (
    <div className="mt-3.5 flex items-center">
      <div className="w-[96px]">
        <div className="text-[12.5px] font-bold" style={{ color: "var(--foreground)" }}>
          {label}
        </div>
        <div className="text-[10.5px]" style={{ color: "var(--text-faint)" }}>
          {hint}
        </div>
      </div>
      <div className="flex items-center gap-[7px]">
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            title={c}
            className="h-[26px] w-[26px] rounded-[4px] border"
            style={{
              background: c,
              borderColor: "var(--border)",
              outline:
                value.toLowerCase() === c.toLowerCase() ? "2px solid var(--primary)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
        {/* Custom: any color they want */}
        <button
          onClick={() => inputRef.current?.click()}
          title="Pick any color"
          className="relative flex h-[26px] w-[26px] items-center justify-center rounded-[4px] border"
          style={{
            borderColor: "var(--border)",
            // eslint-disable-next-line no-restricted-syntax -- a color picker shows literal colors
            background: "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
            outline: !isPreset ? "2px solid var(--primary)" : "none",
            outlineOffset: 2,
          }}
        >
          <span
            className="text-[13px] font-extrabold text-white"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            +
          </span>
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            tabIndex={-1}
          />
        </button>
      </div>
    </div>
  );
}
