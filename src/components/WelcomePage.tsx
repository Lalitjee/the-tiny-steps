import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import logo from "@/assets/logo.png";

export function WelcomePage() {
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
