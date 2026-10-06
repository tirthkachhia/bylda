import { createFileRoute } from "@tanstack/react-router";
import { C7CallsManualUpload } from "@/components/lanes/lane-2/calls/C7CallsManualUpload";

// C7 · Calls — Manual upload · Figma 28:1263 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/upload")({ component: C7CallsManualUpload });
