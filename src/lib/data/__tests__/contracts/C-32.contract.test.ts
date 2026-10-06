import { C32 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C32 as unknown as Contract<Record<string, unknown>, unknown>);
