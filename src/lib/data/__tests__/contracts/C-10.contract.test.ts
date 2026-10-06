import { C10 } from "../../contracts/flow1";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C10 as unknown as Contract<Record<string, unknown>, unknown>);
