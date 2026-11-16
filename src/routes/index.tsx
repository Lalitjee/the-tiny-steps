import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Mail, Star } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  return user ? <HomePage /> : <WelcomePage />;
}

/* ------------------------------------------------------------------ */
/* Signed out: sign in / sign up                                       */
/* ------------------------------------------------------------------ */

function WelcomePage() {
  useDocumentTitle("The Tiny Steps");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        const trimmedEmail = email.trim();
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { full_name: fullName.trim() || undefined } },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is on for the project: no session until the link is clicked.
          setAwaitingConfirmation(trimmedEmail);
        } else {
          toast.success("Account created. You're signed in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <img src={logo} alt="" width={96} height={96} className="mb-6 rounded-3xl shadow-elevated" />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">The Tiny Steps</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Little steps, big stars. Cheer on good habits with points, and watch them add up together.
        </p>

        {awaitingConfirmation ? (
          <Card className="mt-8 w-full max-w-sm p-6 text-center">
            <Mail className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Confirm your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{awaitingConfirmation}</span>. Click it, then sign in here.
            </p>
            <Button
              variant="ghost"
              className="mt-4 text-xs"
              onClick={() => {
                setAwaitingConfirmation(null);
                setMode("sign-in");
              }}
            >
              Back to sign in
            </Button>
          </Card>
        ) : (
          <Card className="mt-8 w-full max-w-sm p-6 text-left">
            <h2 className="text-lg font-semibold mb-4 text-center">
              {mode === "sign-in" ? "Sign in" : "Create your account"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "sign-up" && (
                <div>
                  <Label htmlFor="fullName" className="text-xs">Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  required
                />
              </div>
              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
              </Button>
            </form>
            {mode === "sign-up" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Use the same email your family invite was sent to. You'll be added to the family automatically.
              </p>
            )}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "sign-in" ? (
                <>
                  New here?{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("sign-up")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("sign-in")}>
                    Sign in
                  </button>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Signed in: shell (kids, dashboard and habits come in later steps)   */
/* ------------------------------------------------------------------ */

function HomePage() {
  useDocumentTitle("The Tiny Steps");
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const userId = user!.id;

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
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" width={32} height={32} className="rounded-lg" />
            <span className="font-semibold">The Tiny Steps</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {accept.isError && (
          <Card className="p-4 text-sm text-destructive">
            Couldn't check for family invites. Did you run the SQL setup in Supabase?
          </Card>
        )}

        {memberships.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : memberships.isError ? (
          <Card className="p-4 text-sm text-destructive">Couldn't load your family: {memberships.error.message}</Card>
        ) : memberships.data.length === 0 ? (
          <CreateFamily userId={userId} onCreated={() => qc.invalidateQueries({ queryKey: ["memberships", userId] })} />
        ) : (
          memberships.data.map((m) => {
            const fam = Array.isArray(m.rw_families) ? m.rw_families[0] : m.rw_families;
            return (
              <Card key={m.family_id} className="p-5">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-star text-star" />
                  <h2 className="text-lg font-semibold">{fam?.name ?? "Your family"}</h2>
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {m.role === "parent" ? "Parent" : "Kid view"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  You're in. Kids, points and habits are coming in the next steps.
                </p>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}

function CreateFamily({ userId, onCreated }: { userId: string; onCreated: () => void }) {
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
    <Card className="p-5" data-user={userId}>
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
