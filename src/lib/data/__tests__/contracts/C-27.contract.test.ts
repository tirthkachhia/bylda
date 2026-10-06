import { C27 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C27 as unknown as Contract<Record<string, unknown>, unknown>);
