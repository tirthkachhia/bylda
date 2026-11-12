export type WorkspaceView = "agent" | "manager";
const intentKey = "bylda:login-view";
const viewKey = (userId: string) => `bylda:workspace-view:${userId}`;

export function setWorkspaceView(userId: string, view: WorkspaceView) {
  // Keep presentation separate from authorization: the provider must verify
  // manager membership before it renders this view.
  sessionStorage.setItem(viewKey(userId), view);
  sessionStorage.removeItem(intentKey);
}

export function readWorkspaceView(userId: string): WorkspaceView {
  try {
    // OAuth from the agent form must reset a previous manager presentation.
    if (sessionStorage.getItem(intentKey) === "agent") {
      setWorkspaceView(userId, "agent");
      return "agent";
    }
    return sessionStorage.getItem(viewKey(userId)) === "manager" ? "manager" : "agent";
  } catch {
    return "agent";
  }
}

export function clearWorkspaceView(userId: string) {
  try {
    sessionStorage.removeItem(viewKey(userId));
    sessionStorage.removeItem(intentKey);
  } catch {
    /* Storage can be disabled. */
  }
}

export function startAgentOAuth() {
  // Failing to persist intent should stop the login rather than restoring the
  // previous manager presentation after an agent explicitly chooses agent login.
  sessionStorage.setItem(intentKey, "agent");
}
