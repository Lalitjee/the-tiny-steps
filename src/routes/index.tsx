import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AppShell";
import { KidsPage } from "@/components/KidsPage";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  useDocumentTitle("The Tiny Steps");
  return (
    <AuthGate>
      <KidsPage />
    </AuthGate>
  );
}
