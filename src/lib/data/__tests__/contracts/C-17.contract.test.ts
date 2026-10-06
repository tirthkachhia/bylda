import { C17 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C17 as unknown as Contract<Record<string, unknown>, unknown>);
