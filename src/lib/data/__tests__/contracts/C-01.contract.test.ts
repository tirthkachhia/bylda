import { C01 } from "../../contracts/flow1";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C01 as unknown as Contract<Record<string, unknown>, unknown>);
