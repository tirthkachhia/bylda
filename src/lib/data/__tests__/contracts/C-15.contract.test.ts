import { C15 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C15 as unknown as Contract<Record<string, unknown>, unknown>);
