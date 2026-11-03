import { createFileRoute } from "@tanstack/react-router";
import { CoachingAssignments } from "@/components/app/coaching/CoachingAssignments";
export const Route = createFileRoute("/app/coaching")({ component: CoachingAssignments });
