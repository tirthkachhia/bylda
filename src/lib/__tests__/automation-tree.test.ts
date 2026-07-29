import { describe, it, expect } from "vitest";
import {
  makeBranches,
  isBranchingType,
  countBlocksDeep,
  findBlockDeep,
  updateBlockDeep,
  removeBlockDeep,
  insertBlockDeep,
  moveBlockDeep,
  type WorkflowBlock,
} from "@/lib/automation-blocks";

function block(id: string, type: WorkflowBlock["type"] = "action_add_tag"): WorkflowBlock {
  return { id, type, label: "", config: {} };
}

/** A trunk with an If/Else whose Yes lane holds one step. */
function sampleTree(): WorkflowBlock[] {
  const branch: WorkflowBlock = {
    id: "if1",
    type: "logic_if_branch",
    label: "",
    config: { condition: "score > 70" },
    branches: makeBranches("logic_if_branch"),
  };
  branch.branches![0].blocks.push(block("yes1"));
  return [block("t1", "trigger_new_lead"), branch, block("a1", "action_send_email")];
}

describe("isBranchingType / makeBranches", () => {
  it("identifies branching block types", () => {
    expect(isBranchingType("logic_if_branch")).toBe(true);
    expect(isBranchingType("logic_split_test")).toBe(true);
    expect(isBranchingType("action_send_email")).toBe(false);
  });

  it("creates the right lanes for each branching type", () => {
    expect(makeBranches("logic_if_branch")?.map((b) => b.id)).toEqual(["yes", "no"]);
    expect(makeBranches("logic_split_test")?.map((b) => b.id)).toEqual(["a", "b"]);
    expect(makeBranches("action_send_email")).toBeUndefined();
  });
});

describe("countBlocksDeep", () => {
  it("counts nested branch blocks", () => {
    // trunk: trigger + if + action = 3, plus 1 inside the Yes lane = 4
    expect(countBlocksDeep(sampleTree())).toBe(4);
  });
});

describe("findBlockDeep", () => {
  it("finds blocks at the top level and inside lanes", () => {
    const tree = sampleTree();
    expect(findBlockDeep(tree, "a1")?.id).toBe("a1");
    expect(findBlockDeep(tree, "yes1")?.id).toBe("yes1");
    expect(findBlockDeep(tree, "nope")).toBeNull();
  });
});

describe("insertBlockDeep", () => {
  it("appends to the trunk when containerId is null", () => {
    const tree = insertBlockDeep(sampleTree(), null, null, block("new"));
    expect(tree[tree.length - 1].id).toBe("new");
    expect(countBlocksDeep(tree)).toBe(5);
  });

  it("appends into the named branch lane", () => {
    const tree = insertBlockDeep(sampleTree(), "if1", "no", block("no1"));
    const ifBlock = findBlockDeep(tree, "if1")!;
    expect(ifBlock.branches!.find((b) => b.id === "no")!.blocks.map((b) => b.id)).toEqual(["no1"]);
  });
});

describe("updateBlockDeep", () => {
  it("merges config on a nested block without touching siblings", () => {
    const tree = updateBlockDeep(sampleTree(), "yes1", { config: { tag: "vip" } });
    expect(findBlockDeep(tree, "yes1")!.config.tag).toBe("vip");
    // trunk action untouched
    expect(findBlockDeep(tree, "a1")!.config).toEqual({});
  });
});

describe("removeBlockDeep", () => {
  it("removes a nested block", () => {
    const tree = removeBlockDeep(sampleTree(), "yes1");
    expect(findBlockDeep(tree, "yes1")).toBeNull();
    expect(countBlocksDeep(tree)).toBe(3);
  });

  it("removes a trunk block and its lanes", () => {
    const tree = removeBlockDeep(sampleTree(), "if1");
    expect(findBlockDeep(tree, "if1")).toBeNull();
    expect(findBlockDeep(tree, "yes1")).toBeNull();
    expect(countBlocksDeep(tree)).toBe(2);
  });
});

describe("moveBlockDeep", () => {
  it("reorders within the trunk", () => {
    const tree = moveBlockDeep(sampleTree(), "a1", -1); // move action up past the if block
    expect(tree.map((b) => b.id)).toEqual(["t1", "a1", "if1"]);
  });

  it("is a no-op at a boundary", () => {
    const tree = moveBlockDeep(sampleTree(), "t1", -1);
    expect(tree.map((b) => b.id)).toEqual(["t1", "if1", "a1"]);
  });

  it("reorders within a branch lane", () => {
    let tree = insertBlockDeep(sampleTree(), "if1", "yes", block("yes2"));
    tree = moveBlockDeep(tree, "yes2", -1);
    const yes = findBlockDeep(tree, "if1")!.branches!.find((b) => b.id === "yes")!;
    expect(yes.blocks.map((b) => b.id)).toEqual(["yes2", "yes1"]);
  });
});
