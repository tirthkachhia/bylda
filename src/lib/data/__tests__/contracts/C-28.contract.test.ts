import { C28 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C28 as unknown as Contract<Record<string, unknown>, unknown>);
