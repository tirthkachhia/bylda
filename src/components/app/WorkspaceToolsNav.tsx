import { Link } from "@tanstack/react-router";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";

export function WorkspaceToolsNav({ active }: { active: string }) {
  const access = useCoachingWorkspaceAccess();
  return (
    <nav className="page30-glass page30-tool-tabs" aria-label="Workspace tools">
      {access.manager && (
        <>
          <Link
            to="/app/integrations"
            search={{ tab: "delivery" }}
            aria-current={active === "delivery" ? "page" : undefined}
          >
            Delivery channels
          </Link>
          <Link
            to="/app/crm/calls"
            search={{ view: "playbooks" }}
            aria-current={active === "playbooks" ? "page" : undefined}
          >
            Playbooks
          </Link>
          <Link
            to="/app/settings"
            search={{ tab: "users" }}
            aria-current={active === "users" ? "page" : undefined}
          >
            People & invitations
          </Link>
          <Link
            to="/app/settings"
            search={{ tab: "privacy" }}
            aria-current={active === "privacy" ? "page" : undefined}
          >
            Privacy
          </Link>
        </>
      )}
      <Link
        to="/app/settings"
        search={{ tab: "notifications" }}
        aria-current={active === "notifications" ? "page" : undefined}
      >
        Notifications
      </Link>
      <Link
        to="/app/settings"
        search={{ tab: "profile" }}
        aria-current={active === "profile" ? "page" : undefined}
      >
        My profile
      </Link>
    </nav>
  );
}
