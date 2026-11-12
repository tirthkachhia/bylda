import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { chooseLoginWorkspace } from "../manager-access";
const memberships = [
  { organization_id: "personal", role: "owner" },
  { organization_id: "work", role: "manager" },
  { organization_id: "agent", role: "member" },
];
describe("login workspace selection", () => {
  it("finds a manager's invited workspace ahead of a provisioned personal account", () => {
    expect(chooseLoginWorkspace(memberships, true, null)?.organization_id).toBe("work");
  });
  it("rejects agent-only manager access and ignores a saved unauthorized workspace", () => {
    expect(chooseLoginWorkspace([memberships[2]], true, "agent")).toBeUndefined();
    expect(chooseLoginWorkspace(memberships, true, "agent")?.organization_id).toBe("work");
    expect(chooseLoginWorkspace(memberships, true, "forged")?.organization_id).toBe("work");
  });
  it("opens an agent's linked workspace ahead of a provisioned personal account", () => {
    expect(chooseLoginWorkspace(memberships, false, null, ["agent"])?.organization_id).toBe(
      "agent",
    );
  });
  it("preserves a verified workspace selection", () => {
    expect(chooseLoginWorkspace(memberships, true, "personal")?.organization_id).toBe("personal");
  });
});
