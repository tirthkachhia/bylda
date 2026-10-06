#!/usr/bin/env node
// tokens-check — no raw colours in src/** outside src/styles/bylda.css (CLAUDE.md §3, §12 G).
//
// Flags hex colours (#abc, #aabbcc, #aabbccdd) and rgb()/rgba()/hsl()/hsla()
// literals in .ts/.tsx/.js/.jsx/.css under src/. The ONLY file allowed to hold
// raw colours is src/styles/bylda.css — everything else binds to `by-*` tokens.
//
// Legacy code (Launchpad/CRM, pre-V1) already has thousands of raw colours. Those
// files are listed with their current count in scripts/tokens-baseline.json and
// may only go DOWN: a file not in the baseline must have zero, and a baselined
// file may not exceed its count. That makes the rule a hard gate on new code
// without blocking the legacy routes.
//
// Escape hatch for a genuine non-colour match (e.g. a room literally named #fab):
// put `tokens-ignore` in a comment on the same line.
//
//   node scripts/tokens-check.mjs                     check
//   node scripts/tokens-check.mjs --update-baseline   rewrite the baseline (Ansh only)
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "scripts", "tokens-baseline.json");
const ALLOWED = new Set(["src/styles/bylda.css"]);
const SKIP = new Set(["src/routeTree.gen.ts"]);
const EXT = /\.(tsx?|jsx?|css)$/;
const COLOR =
  /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

function scan() {
  const hits = {};
  for (const abs of walk(SRC)) {
    const rel = relative(ROOT, abs).split("\\").join("/");
    if (ALLOWED.has(rel) || SKIP.has(rel)) continue;
    const lines = readFileSync(abs, "utf8").split("\n");
    const found = [];
    lines.forEach((line, i) => {
      if (line.includes("tokens-ignore")) return;
      for (const m of line.matchAll(COLOR)) found.push({ line: i + 1, text: m[0] });
    });
    if (found.length) hits[rel] = found;
  }
  return hits;
}

const hits = scan();

if (process.argv.includes("--update-baseline")) {
  const counts = Object.fromEntries(
    Object.entries(hits)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, h]) => [f, h.length]),
  );
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`tokens: baseline rewritten — ${Object.keys(counts).length} legacy files.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  console.error("tokens: scripts/tokens-baseline.json missing — refusing to pass.");
  process.exit(2);
}

const failures = [];
for (const [file, found] of Object.entries(hits)) {
  const allowed = baseline[file] ?? 0;
  if (found.length > allowed) failures.push({ file, found, allowed });
}

const legacy = Object.keys(baseline).length;
if (failures.length === 0) {
  console.log(
    `✅ tokens clean — no new raw colours (${legacy} legacy files baselined; only src/styles/bylda.css may define colours).`,
  );
  process.exit(0);
}

console.log("❌ RAW COLOUR outside src/styles/bylda.css — use a semantic by-* token instead:\n");
for (const { file, found, allowed } of failures) {
  const label = allowed ? `${found.length} (baseline ${allowed})` : `${found.length}`;
  console.log(`  ${file}  — ${label}`);
  for (const f of found.slice(0, 8)) console.log(`      line ${f.line}: ${f.text}`);
  if (found.length > 8) console.log(`      … ${found.length - 8} more`);
}
console.log("\nTokens: CLAUDE.md §3 · src/styles/bylda.css. Legacy files may only go down.");
process.exit(1);
