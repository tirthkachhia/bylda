import { C23 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C23 as unknown as Contract<Record<string, unknown>, unknown>);
