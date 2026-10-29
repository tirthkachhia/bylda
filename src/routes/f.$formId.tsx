import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/f/$formId")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
