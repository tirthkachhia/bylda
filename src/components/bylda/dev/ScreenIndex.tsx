import { Link } from "@tanstack/react-router";
import { SCREENS, Tag } from "@/components/bylda";
import { AREA_NAMES } from "../shell/screens";

/** /dev/screens — every V1 view, its Figma node, lane, route. Dev + mock mode only. */
export function ScreenIndex() {
  const areas = Object.keys(AREA_NAMES).filter((a) => SCREENS.some((s) => s.area === a));
  return (
    <main className="bylda min-h-screen">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-10 py-12">
        <h1 className="type-editorial-h1">Bylda V1 — {SCREENS.length} screens</h1>
        {areas.map((a) => (
          <section key={a} className="flex flex-col gap-2">
            <h2 className="type-ui-label text-by-text-secondary">
              {a} · {AREA_NAMES[a]}
            </h2>
            <table className="type-ui-small w-full">
              <tbody>
                {SCREENS.filter((s) => s.area === a).map((s) => {
                  const href = s.url?.replace(
                    /\$[a-zA-Z]+/g,
                    (p) =>
                      ({
                        $callId: "call_acme",
                        $repId: "u_jordan",
                        $teamId: "team_mm",
                        $focusId: "cf_jordan_pause",
                        $roomId: "room_objections",
                        $threadId: "dm_dana_jordan",
                        $behaviorKey: "pause_after_objection",
                        $methodologyId: "meth_meddic",
                        $ruleKey: "pause_after_objection",
                        $momentId: "call_acme",
                      })[p] ?? p,
                  );
                  return (
                    <tr key={s.code} className="border-b border-by-border-engraved">
                      <td className="type-mono-data w-14 py-1.5">{s.code}</td>
                      <td className="py-1.5">
                        {href ? (
                          <Link to={href as never} className="underline">
                            {s.name}
                          </Link>
                        ) : (
                          s.name
                        )}
                      </td>
                      <td className="type-mono-micro w-24 text-by-text-tertiary">{s.node}</td>
                      <td className="w-32">
                        <Tag tone="neutral">
                          L{s.lane} · {s.owner}
                        </Tag>
                      </td>
                      <td className="type-mono-micro w-72 text-by-text-tertiary">
                        {s.url ?? `component · ${s.kind}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}
