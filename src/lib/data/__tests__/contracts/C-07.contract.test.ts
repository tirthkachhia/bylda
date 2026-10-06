import { C07 } from "../../contracts/flow1";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C07 as unknown as Contract<Record<string, unknown>, unknown>);
