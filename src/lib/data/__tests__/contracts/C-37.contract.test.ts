import { C37 } from "../../contracts/later";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C37 as unknown as Contract<Record<string, unknown>, unknown>);
