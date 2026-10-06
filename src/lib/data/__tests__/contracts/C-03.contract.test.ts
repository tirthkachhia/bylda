import { C03 } from "../../contracts/flow1";
import type { Contract } from "../../contracts/types";
import { runContract } from "./runContract";

runContract(C03 as unknown as Contract<Record<string, unknown>, unknown>);
