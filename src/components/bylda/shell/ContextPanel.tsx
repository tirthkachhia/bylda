import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The context panel slot (344px, closable; overlay drawer ≤1280). A screen fills it
 * by rendering <ContextPanel>…</ContextPanel> anywhere in its tree — the shell owns
 * the geometry, the screen owns the content.
 */
type Slot = { node: HTMLElement | null; register: () => () => void };
const Ctx = createContext<Slot | null>(null);

export function ContextPanelProvider({
  node,
  onCountChange,
  children,
}: {
  node: HTMLElement | null;
  onCountChange: (update: (n: number) => number) => void;
  children: ReactNode;
}) {
  const register = () => {
    onCountChange((c) => c + 1);
    return () => onCountChange((c) => c - 1);
  };
  return <Ctx.Provider value={{ node, register }}>{children}</Ctx.Provider>;
}

export function ContextPanel({ title, children }: { title?: string; children: ReactNode }) {
  const slot = useContext(Ctx);
  useEffect(() => slot?.register(), [slot?.node]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!slot?.node) return null;
  return createPortal(
    <div className="flex flex-col gap-4 p-5">
      {title ? <p className="type-ui-label text-by-text-tertiary">{title}</p> : null}
      {children}
    </div>,
    slot.node,
  );
}
