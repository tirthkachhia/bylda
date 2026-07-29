// ModuleBoundary — per-module error isolation (design system §10).
// Dashboard modules own their loading/empty/error *data* states, but a render
// exception would still unmount the whole page. This boundary contains the
// blast radius to the module: the rest of Home keeps working.

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  /** Short human name shown in the fallback, e.g. "AI briefing". */
  name: string;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

export class ModuleBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[module:${this.props.name}] render crash:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        style={{
          borderColor: "color-mix(in oklab, var(--destructive) 25%, var(--border))",
          background: "color-mix(in oklab, var(--destructive) 4%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 text-[12.5px]">
          <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--destructive)" }} />
          <span style={{ color: "var(--muted-foreground)" }}>
            The {this.props.name} module hit an error — the rest of the page is unaffected.
          </span>
        </div>
        <button
          onClick={() => this.setState({ failed: false })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition hover:opacity-80"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          <RefreshCw className="h-3 w-3" /> Reload module
        </button>
      </div>
    );
  }
}
