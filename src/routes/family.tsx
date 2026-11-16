import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AppShell";
import { FamilyPage } from "@/components/FamilyPage";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/family")({
  component: FamilyRoute,
});

function FamilyRoute() {
  useDocumentTitle("Family · The Tiny Steps");
  return (
    <AuthGate>
      <FamilyPage />
    </AuthGate>
  );
}
