import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { FamilyContext } from "@/hooks/use-family";
import { WelcomePage } from "@/components/WelcomePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logo from "@/assets/logo.png";

/**
 * Wraps every page: shows sign-in when signed out, otherwise loads the user's family
 * (accepting any pending invites first) and renders the page inside the app layout.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <WelcomePage />;
  return <FamilyShell userId={user.id}>{children}</FamilyShell>;
}

function FamilyShell({ userId, children }: { userId: string; children: ReactNode }) {
  const { signOut } = useAuth();
  const qc = useQueryClient();

  // Turn pending invites for this login email into memberships (once per sign-in).
  const accept = useQuery({
    queryKey: ["accept-invites", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rw_accept_invites");
      if (error) throw error;
      return data ?? 0;
    },
    staleTime: Infinity,
    retry: false,
  });

  const memberships = useQuery({
    queryKey: ["memberships", userId],
    enabled: !accept.isPending,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rw_family_members")
        .select("family_id, role, rw_families(id, name)")
        .eq("user_id", userId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const first = memberships.data?.[0];
  const fam = first ? (Array.isArray(first.rw_families) ? first.rw_families[0] : first.rw_families) : null;

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src={logo} alt="" width={32} height={32} className="rounded-lg" />
            <span className="truncate font-semibold">{fam?.name ?? "The Tiny Steps"}</span>
          </Link>
          {first && (
            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link
                to="/"
                className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
                activeOptions={{ exact: true }}
              >
                Kids
              </Link>
              <Link
                to="/family"
                className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                Family
              </Link>
            </nav>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={first ? "" : "ml-auto"}
            aria-label="Sign out"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {accept.isError && (
          <Card className="mb-4 p-4 text-sm text-destructive">
            Couldn't check for family invites. Did you run the SQL setup in Supabase?
          </Card>
        )}
        {memberships.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : memberships.isError ? (
          <Card className="p-4 text-sm text-destructive">Couldn't load your family: {memberships.error.message}</Card>
        ) : !first ? (
          <CreateFamily onCreated={() => qc.invalidateQueries({ queryKey: ["memberships", userId] })} />
        ) : (
          <FamilyContext.Provider
            value={{
              userId,
              familyId: first.family_id,
              familyName: fam?.name ?? "Your family",
              role: first.role,
              isParent: first.role === "parent",
            }}
          >
            {children}
          </FamilyContext.Provider>
        )}
      </div>
    </main>
  );
}

function CreateFamily({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: async (familyName: string) => {
      const { data, error } = await supabase.rpc("rw_create_family", { p_name: familyName });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Family created");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Set up your family</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        If your partner already invited you, sign in with the invited email and you'll be added automatically. Otherwise,
        create your family here.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate(name.trim());
        }}
      >
        <div className="flex-1">
          <Label htmlFor="family" className="sr-only">Family name</Label>
          <Input id="family" placeholder="Family name, e.g. The Joshi family" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </form>
    </Card>
  );
}
