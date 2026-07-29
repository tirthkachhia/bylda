// The tool-picker screen is gone — founders never choose from a list of
// tools. The curriculum (mentor-delegated lessons at /app/playbook) is the
// only way work is assigned. Kept as a redirect so old links keep working.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/launchpad/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/playbook", replace: true });
  },
});
