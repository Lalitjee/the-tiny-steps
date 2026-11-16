import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Mail, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import type { Role } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const roleLabel: Record<Role, string> = { parent: "Parent", kid: "Kid login" };

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {roleLabel[role]}
    </span>
  );
}

export function FamilyPage() {
  const { familyId, userId, isParent } = useFamily();
  const qc = useQueryClient();

  const members = useQuery({
    queryKey: ["members", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rw_list_members", { p_family: familyId });
      if (error) throw error;
      // Parents first, then kid logins.
      return [...data].sort((a, b) => Number(b.role === "parent") - Number(a.role === "parent"));
    },
  });

  const invites = useQuery({
    queryKey: ["invites", familyId],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rw_family_invites")
        .select("id, email, role, created_at")
        .eq("family_id", familyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const removeMember = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.from("rw_family_members").delete().eq("family_id", familyId).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from the family");
      qc.invalidateQueries({ queryKey: ["members", familyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rw_family_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", familyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Family</h1>
        <p className="text-sm text-muted-foreground">Who can see and change the points.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Members</h2>
        {members.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : members.isError ? (
          <Card className="p-4 text-sm text-destructive">
            Couldn't load members: {members.error.message}. Did you run the second SQL file (002_rw_list_members)?
          </Card>
        ) : (
          <Card className="divide-y">
            {members.data.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.full_name ?? m.email}
                    {m.user_id === userId && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                  </div>
                  {m.full_name && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
                </div>
                <RoleBadge role={m.role} />
                {isParent && m.user_id !== userId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${m.full_name ?? m.email}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {m.full_name ?? m.email}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They will no longer be able to see this family's points. You can invite them again later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => removeMember.mutate(m.user_id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      {isParent && (
        <>
          <InviteForm
            familyId={familyId}
            userId={userId}
            memberEmails={(members.data ?? []).map((m) => m.email.toLowerCase())}
            onInvited={() => qc.invalidateQueries({ queryKey: ["invites", familyId] })}
          />

          {invites.data && invites.data.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Waiting to join</h2>
              <Card className="divide-y">
                {invites.data.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 p-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1 truncate">{i.email}</div>
                    <RoleBadge role={i.role} />
                    <Button variant="ghost" size="icon" aria-label={`Cancel invite for ${i.email}`} onClick={() => removeInvite.mutate(i.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InviteForm({
  familyId,
  userId,
  memberEmails,
  onInvited,
}: {
  familyId: string;
  userId: string;
  memberEmails: string[];
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("parent");

  const invite = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      if (memberEmails.includes(clean)) throw new Error("That person is already in the family.");
      const { error } = await supabase
        .from("rw_family_invites")
        .insert({ family_id: familyId, email: clean, role, invited_by: userId });
      if (error) {
        if (error.code === "23505") throw new Error("That email has already been invited.");
        throw error;
      }
    },
    onSuccess: () => {
      setEmail("");
      toast.success("Invite saved. Now share the app link with them.");
      onInvited();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("App link copied");
    } catch {
      toast.error("Couldn't copy. The link is " + window.location.origin);
    }
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Invite someone</h2>
      <Card className="space-y-4 p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
        >
          <div>
            <Label htmlFor="invite-email" className="text-xs">Their email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="invite-role" className="text-xs">They are</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">A parent: can add and deduct points</SelectItem>
                <SelectItem value="kid">A kid login: can only view</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={invite.isPending || !email.trim()}>
            <UserPlus className="mr-1 h-4 w-4" /> Save invite
          </Button>
        </form>

        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <p>
            The app doesn't send emails. After saving the invite, share the app link. They sign up with
            <span className="font-medium text-foreground"> that exact email</span> and are added to the family
            automatically.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void copyLink()}>
            <Copy className="mr-1 h-4 w-4" /> Copy app link
          </Button>
        </div>
      </Card>
    </section>
  );
}
