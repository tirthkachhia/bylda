// Regenerates the Contracts section of BACKEND_BACKLOG.md from src/lib/data/contracts.
//   bun run contracts:doc
import { readFileSync, writeFileSync } from "node:fs";
import { renderContractsDoc, spliceDoc } from "../src/lib/data/contracts/doc";

const path = "BACKEND_BACKLOG.md";
writeFileSync(path, spliceDoc(readFileSync(path, "utf8"), renderContractsDoc()));
console.log("contracts: BACKEND_BACKLOG.md updated");
