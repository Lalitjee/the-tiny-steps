import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AppShell";
import { HabitsPage } from "@/components/HabitsPage";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/habits")({
  component: HabitsRoute,
});

function HabitsRoute() {
  useDocumentTitle("Habits · The Tiny Steps");
  return (
    <AuthGate>
      <HabitsPage />
    </AuthGate>
  );
}
