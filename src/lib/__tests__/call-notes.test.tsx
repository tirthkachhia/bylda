import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  notes: [] as unknown[],
  save: vi.fn(),
  remove: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ currentOrgId: "org", user: { id: "me" } }) }));
vi.mock("@/lib/coaching/collaboration", () => ({
  callNotesQuery: () => ({ queryKey: ["notes"] }),
  saveCallNote: state.save,
  deleteCallNote: state.remove,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ isPending: false, error: null, data: state.notes, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
import { CallNotes } from "../../components/app/coaching/CallNotes";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
function type(value: string) {
  const field = host.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function save() {
  return [...host.querySelectorAll("button")].find((b) => b.textContent === "Save note")!;
}
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
  state.notes = [];
  vi.clearAllMocks();
});
describe("call notes", () => {
  it("saves entered notes and reloads them on reopening the call", async () => {
    state.save.mockImplementation(async () => {
      state.notes = [
        {
          id: "note",
          call_id: "call",
          organization_id: "org",
          author_id: "me",
          body: "Check the agreed payment date",
          created_at: "2026-11-02T12:00:00Z",
          updated_at: "2026-11-02T12:00:00Z",
        },
      ];
    });
    act(() => root.render(<CallNotes callId="call" />));
    type("Check the agreed payment date");
    await act(async () => save().click());
    expect(state.save).toHaveBeenCalledWith(
      "org",
      "call",
      "Check the agreed payment date",
      undefined,
    );
    act(() => {
      root.unmount();
      root = createRoot(host);
      root.render(<CallNotes callId="call" />);
    });
    expect(host.textContent).toContain("Check the agreed payment date");
  });
  it("preserves the draft when saving fails", async () => {
    state.save.mockRejectedValueOnce(new Error("Connection interrupted"));
    act(() => root.render(<CallNotes callId="call" />));
    type("Do not lose my draft");
    await act(async () => save().click());
    expect(host.querySelector("textarea")?.value).toBe("Do not lose my draft");
    expect(host.textContent).toContain("Connection interrupted");
  });
  it("does not offer edit/delete controls for another person's note", () => {
    state.notes = [
      {
        id: "note",
        author_id: "other",
        body: "Another coach's observation",
        created_at: "2026-11-02",
        updated_at: "2026-11-02",
      },
    ];
    act(() => root.render(<CallNotes callId="call" />));
    expect(host.textContent).toContain("Another coach's observation");
    expect(
      [...host.querySelectorAll("button")].some(
        (b) => b.textContent === "Edit note" || b.textContent === "Delete note",
      ),
    ).toBe(false);
  });
});
