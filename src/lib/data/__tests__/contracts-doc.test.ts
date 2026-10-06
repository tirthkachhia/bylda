import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_END, DOC_START, renderContractsDoc } from "../contracts/doc";

describe("BACKEND_BACKLOG.md", () => {
  it("contracts section is up to date — run `bun run contracts:doc` if this fails", () => {
    const file = readFileSync(join(process.cwd(), "BACKEND_BACKLOG.md"), "utf8");
    const s = file.indexOf(DOC_START);
    const e = file.indexOf(DOC_END);
    expect(s, "contracts markers missing").toBeGreaterThan(-1);
    expect(file.slice(s, e + DOC_END.length)).toBe(renderContractsDoc());
  });
});
