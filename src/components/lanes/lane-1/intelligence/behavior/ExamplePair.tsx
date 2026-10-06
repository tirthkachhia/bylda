import { Button, EvidenceBlock, cn } from "@/components/bylda";
import { Link } from "@tanstack/react-router";
import type { BehaviorDetail, BehaviorExample } from "@/lib/data";

/**
 * EXAMPLE TO AVOID / EXAMPLE TO COPY (Figma 11:250). Names reps, so it only renders from a
 * successful manager fetch (loadBehaviorDetail refuses a rep). Either card may be absent.
 */
export function ExamplePair({ examples }: { examples: BehaviorDetail["examples"] }) {
  if (!examples.avoid && !examples.copy) return null;
  return (
    <div className="flex items-stretch gap-5 max-[1024px]:flex-col">
      {examples.avoid ? <ExampleCard kind="avoid" example={examples.avoid} /> : null}
      {examples.copy ? <ExampleCard kind="copy" example={examples.copy} /> : null}
    </div>
  );
}

function ExampleCard({ kind, example }: { kind: "avoid" | "copy"; example: BehaviorExample }) {
  const firstName = example.repName.split(" ")[0];
  return (
    <section className="flex min-w-0 flex-1 flex-col items-start gap-2 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-3.5">
      <h2
        className={cn(
          "type-ui-label",
          kind === "avoid" ? "text-by-signal-regress" : "text-by-signal-improve",
        )}
      >
        {kind === "avoid" ? "EXAMPLE TO AVOID" : "EXAMPLE TO COPY"}
      </h2>
      <p className="type-ui-body-strong text-by-text-primary">
        {firstName} × {example.account} · {example.timestamp}
      </p>
      <p className="type-ui-small text-by-text-secondary">{example.summary}</p>
      <EvidenceBlock
        evidence={{
          timestamp: example.moment.timestamp,
          speaker: example.moment.speakerLabel,
          quote: example.moment.quote,
          href: `/app/calls/${example.callId}`,
        }}
      />
      <Button variant="secondary" asChild>
        <Link to="/app/calls/$callId" params={{ callId: example.callId }}>
          Open call
          {example.clipSeconds ? ` · clip 0:${String(example.clipSeconds).padStart(2, "0")}` : ""}
        </Link>
      </Button>
    </section>
  );
}
