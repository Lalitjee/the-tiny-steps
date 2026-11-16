import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AppShell";
import { KidDashboard } from "@/components/KidDashboard";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/kid/$kidId")({
  component: KidRoute,
});

function KidRoute() {
  useDocumentTitle("Points · The Tiny Steps");
  const { kidId } = Route.useParams();
  return (
    <AuthGate>
      <KidDashboard kidId={kidId} />
    </AuthGate>
  );
}
