import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "./auth.sign-in";

export const Route = createFileRoute("/auth/manager-sign-in")({
  component: () => <SignIn manager />,
});
