import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type KidTotals = {
  kid_id: string;
  name: string;
  balance: number;
  total_earned: number;
  total_deducted: number;
};

export function KidsPage() {
  const { familyId, isParent } = useFamily();
  const qc = useQueryClient();
  const kidsKey = ["kids", familyId];

  const kids = useQuery({
    queryKey: kidsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rw_kid_totals")
        .select("kid_id, name, balance, total_earned, total_deducted")
        .eq("family_id", familyId)
        .order("name");
      if (error) throw error;
      return data as KidTotals[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: kidsKey });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kids</h1>
          <p className="text-sm text-muted-foreground">Everyone's stars at a glance.</p>
        </div>
      </div>

      {kids.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : kids.isError ? (
        <Card className="p-4 text-sm text-destructive">Couldn't load kids: {kids.error.message}</Card>
      ) : kids.data.length === 0 ? (
        <Card className="p-6 text-center">
          <Star className="mx-auto mb-2 h-8 w-8 fill-star text-star" />
          <p className="font-medium">No kids yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isParent ? "Add your first child below to start giving stars." : "A parent needs to add the kids first."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {kids.data.map((k) => (
            <KidCard key={k.kid_id} kid={k} canEdit={isParent} onChanged={refresh} />
          ))}
        </div>
      )}

      {isParent && <AddKid familyId={familyId} onAdded={refresh} />}
    </div>
  );
}

function hueOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function KidCard({ kid, canEdit, onChanged }: { kid: KidTotals; canEdit: boolean; onChanged: () => void }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(kid.name);
  const hue = hueOf(kid.kid_id);

  const rename = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("rw_kids").update({ name }).eq("id", kid.kid_id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRenameOpen(false);
      toast.success("Name updated");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rw_kids").delete().eq("id", kid.kid_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${kid.name} removed`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="flex items-center gap-2 p-2 pr-3 shadow-card">
      <Link
        to="/kid/$kidId"
        params={{ kidId: kid.kid_id }}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 hover:bg-accent/50"
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{ backgroundColor: `oklch(0.92 0.06 ${hue})`, color: `oklch(0.4 0.14 ${hue})` }}
          aria-hidden
        >
          {kid.name.trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{kid.name}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-earn">+{kid.total_earned} earned</span>
            {kid.total_deducted > 0 && <span className="text-deduct"> · −{kid.total_deducted} deducted</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 text-2xl font-bold tabular-nums">
          <Star className="h-6 w-6 fill-star text-star" />
          {kid.balance}
        </div>
      </Link>

      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Options for ${kid.name}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setNewName(kid.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename {kid.name}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newName.trim()) rename.mutate(newName.trim());
                }}
              >
                <Label htmlFor={`rename-${kid.kid_id}`} className="sr-only">Name</Label>
                <Input id={`rename-${kid.kid_id}`} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                <DialogFooter className="mt-4">
                  <Button type="submit" disabled={rename.isPending || !newName.trim()}>Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {kid.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {kid.name}'s points history and habits. It can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => remove.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </Card>
  );
}

function AddKid({ familyId, onAdded }: { familyId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: async (kidName: string) => {
      const { error } = await supabase.from("rw_kids").insert({ family_id: familyId, name: kidName });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      toast.success("Kid added");
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate(name.trim());
        }}
      >
        <div className="flex-1">
          <Label htmlFor="new-kid" className="sr-only">Child's name</Label>
          <Input id="new-kid" placeholder="Add a child, e.g. Aanya" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </form>
    </Card>
  );
}
