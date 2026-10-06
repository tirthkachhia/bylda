import { StateEmpty } from "./SystemState";

/**
 * What every not-yet-built V1 screen renders. Lanes replace the component body;
 * the route file and nav links already point here.
 */
export function ScreenPlaceholder({
  code,
  name,
  node,
  lane,
  owner,
  bare = false,
}: {
  code: string;
  name: string;
  node: string;
  lane: number;
  owner: string;
  /** true for screens outside the app shell (welcome, doc, mobile) */
  bare?: boolean;
}) {
  const inner = (
    <StateEmpty
      eyebrow={`${code} · FIGMA ${node} · LANE ${lane} · ${owner.toUpperCase()}`}
      tagLabel="Coming soon"
      title={`Coming soon: ${name}`}
      body={`Placeholder for ${code}. Build it from Figma node ${node} using @/components/bylda and @/lib/data.`}
    />
  );
  if (bare) {
    return <main className="bylda flex min-h-screen items-center justify-center p-6">{inner}</main>;
  }
  return <div className="flex min-h-full items-start justify-center p-10">{inner}</div>;
}
