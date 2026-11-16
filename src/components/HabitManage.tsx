import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Copy, MoreVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import { todayIST } from "@/lib/dates";
import { frequencyHints, frequencyLabels } from "@/lib/habits";
import type { Database, Frequency } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

type Habit = Database["public"]["Tables"]["rw_habits"]["Row"];
type Kid = { id: string; name: string };

export function HabitManage({ kids }: { kids: Kid[] }) {
  const { familyId } = useFamily();
  const qc = useQueryClient();
  const [formFor, setFormFor] = useState<{ habit: Habit | null } | null>(null);
  const [copyFrom, setCopyFrom] = useState<Kid | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const habits = useQuery({
    queryKey: ["habits", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rw_habits").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["habits", familyId] });
    qc.invalidateQueries({ queryKey: ["pending-habits", familyId] });
  };

  const setActive = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase.from("rw_habits").update({ active: v.active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Habit restored" : "Habit archived");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (kids.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Add a child first on the{" "}
        <Link to="/" className="font-medium text-primary hover:underline">Kids</Link> page, then come back to set up habits.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Habits earn points when you mark them Done on the Review tab.
        </p>
        <Button onClick={() => setFormFor({ habit: null })}>
          <Plus className="mr-1 h-4 w-4" /> New habit
        </Button>
      </div>

      {habits.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : habits.isError ? (
        <Card className="p-4 text-sm text-destructive">Couldn't load habits: {habits.error.message}</Card>
      ) : (
        kids.map((kid) => {
          const list = habits.data.filter((h) => h.kid_id === kid.id);
          return (
            <section key={kid.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-sm font-semibold text-muted-foreground">{kid.name}</h2>
                {list.length > 0 && kids.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setCopyFrom(kid)}>
                    <Copy className="mr-1 h-4 w-4" /> Copy to another kid
                  </Button>
                )}
              </div>
              {list.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">No habits yet for {kid.name}.</Card>
              ) : (
                <Card className="divide-y">
                  {list.map((h) => (
                    <div key={h.id} className={cn("flex items-center gap-3 p-3", !h.active && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-medium">{h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {frequencyLabels[h.frequency]}
                          {!h.active && " · Archived"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold tabular-nums">
                        <Star className="h-4 w-4 fill-star text-star" />{h.points}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Options for ${h.name}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setFormFor({ habit: h })}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setActive.mutate({ id: h.id, active: !h.active })}>
                            {h.active ? (
                              <><Archive className="mr-2 h-4 w-4" /> Archive</>
                            ) : (
                              <><ArchiveRestore className="mr-2 h-4 w-4" /> Restore</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(h)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          );
        })
      )}

      {formFor && (
        <HabitFormDialog kids={kids} habit={formFor.habit} onClose={() => setFormFor(null)} onSaved={refresh} />
      )}
      {copyFrom && habits.data && (
        <CopyHabitsDialog
          from={copyFrom}
          kids={kids}
          allHabits={habits.data}
          onClose={() => setCopyFrom(null)}
          onSaved={refresh}
        />
      )}
      {deleting && (
        <DeleteHabitDialog
          habit={deleting}
          onClose={() => setDeleting(null)}
          onArchive={() => setActive.mutate({ id: deleting.id, active: false })}
          onDeleted={refresh}
        />
      )}
    </div>
  );
}

/* ---------------------------- add / edit ---------------------------- */

function HabitFormDialog({
  kids,
  habit,
  onClose,
  onSaved,
}: {
  kids: Kid[];
  habit: Habit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayIST();
  const editing = !!habit;
  const [kidId, setKidId] = useState(habit?.kid_id ?? kids[0].id);
  const [name, setName] = useState(habit?.name ?? "");
  const [points, setPoints] = useState(habit ? String(habit.points) : "");
  const [frequency, setFrequency] = useState<Frequency>(habit?.frequency ?? "daily");
  const [startDate, setStartDate] = useState(today);

  const n = Number(points);
  const valid = name.trim().length > 0 && Number.isInteger(n) && n >= 1 && n <= 10000 && (editing || startDate !== "");

  const save = useMutation({
    mutationFn: async () => {
      if (habit) {
        const { error } = await supabase.from("rw_habits").update({ name: name.trim(), points: n }).eq("id", habit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rw_habits")
          .insert({ kid_id: kidId, name: name.trim(), points: n, frequency, start_date: startDate });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Habit updated" : "Habit added");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing the points only affects future reviews. Past entries keep their points."
              : "Pick how often it can be rewarded and how many points it earns."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          {!editing && kids.length > 1 && (
            <div>
              <Label htmlFor="habit-kid" className="text-xs">For</Label>
              <Select value={kidId} onValueChange={setKidId}>
                <SelectTrigger id="habit-kid"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kids.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="habit-name" className="text-xs">Habit</Label>
            <Input
              id="habit-name"
              placeholder="e.g. Brush teeth"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="habit-points" className="text-xs">Points</Label>
              <Input
                id="habit-points"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                step={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="habit-frequency" className="text-xs">How often</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)} disabled={editing}>
                <SelectTrigger id="habit-frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(frequencyLabels) as Frequency[]).map((f) => (
                    <SelectItem key={f} value={f}>{frequencyLabels[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {editing ? "To change how often, archive this habit and create a new one." : frequencyHints[frequency]}
          </p>
          {!editing && (
            <div>
              <Label htmlFor="habit-start" className="text-xs">Starts on</Label>
              <Input id="habit-start" type="date" max={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <p className="mt-1 text-xs text-muted-foreground">
                Review items appear from this date. An earlier date lets you catch up on the last 30 days.
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add habit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- copy to another kid ------------------------- */

function CopyHabitsDialog({
  from,
  kids,
  allHabits,
  onClose,
  onSaved,
}: {
  from: Kid;
  kids: Kid[];
  allHabits: Habit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const others = kids.filter((k) => k.id !== from.id);
  const source = allHabits.filter((h) => h.kid_id === from.id && h.active);
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(source.map((h) => h.id)));

  const copy = useMutation({
    mutationFn: async () => {
      const existing = new Set(
        allHabits.filter((h) => h.kid_id === targetId && h.active).map((h) => `${h.name.trim().toLowerCase()}|${h.frequency}`),
      );
      const toCopy = source.filter((h) => picked.has(h.id));
      const fresh = toCopy.filter((h) => !existing.has(`${h.name.trim().toLowerCase()}|${h.frequency}`));
      if (fresh.length > 0) {
        const today = todayIST();
        const { error } = await supabase.from("rw_habits").insert(
          fresh.map((h) => ({ kid_id: targetId, name: h.name, points: h.points, frequency: h.frequency, start_date: today })),
        );
        if (error) throw error;
      }
      return { copied: fresh.length, skipped: toCopy.length - fresh.length };
    },
    onSuccess: ({ copied, skipped }) => {
      const target = kids.find((k) => k.id === targetId)?.name ?? "";
      toast.success(
        `Copied ${copied} habit${copied === 1 ? "" : "s"} to ${target}` +
          (skipped > 0 ? ` (${skipped} skipped: already there)` : ""),
      );
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy {from.name}'s habits</DialogTitle>
          <DialogDescription>Copies start today. Habits the other child already has are skipped.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="copy-target" className="text-xs">Copy to</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="copy-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {others.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {source.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active habits to copy.</p>
            ) : (
              source.map((h) => (
                <label key={h.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox checked={picked.has(h.id)} onCheckedChange={(c) => toggle(h.id, c === true)} />
                  <span className="min-w-0 flex-1 break-words">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {frequencyLabels[h.frequency]} · {h.points}
                  </span>
                </label>
              ))
            )}
          </div>
          <Button className="w-full" disabled={copy.isPending || picked.size === 0 || !targetId} onClick={() => copy.mutate()}>
            {copy.isPending ? "Copying…" : "Copy habits"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ delete ------------------------------ */

function DeleteHabitDialog({
  habit,
  onClose,
  onArchive,
  onDeleted,
}: {
  habit: Habit;
  onClose: () => void;
  onArchive: () => void;
  onDeleted: () => void;
}) {
  // Deleting a habit also deletes its review entries, and with them the points it earned.
  // So a habit that already has entries can only be archived.
  const logs = useQuery({
    queryKey: ["habit-log-count", habit.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rw_habit_logs")
        .select("id", { count: "exact", head: true })
        .eq("habit_id", habit.id);
      if (error) throw error;
      return count ?? 0;
    },
    gcTime: 0,
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rw_habits").delete().eq("id", habit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Habit deleted");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasHistory = (logs.data ?? 0) > 0;

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{hasHistory ? `Archive "${habit.name}" instead?` : `Delete "${habit.name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {logs.isPending
              ? "Checking…"
              : logs.isError
                ? "Couldn't check this habit's history, so it can't be deleted right now."
                : hasHistory
                  ? `This habit has ${logs.data} reviewed ${logs.data === 1 ? "entry" : "entries"}. Deleting it would also remove the points it earned, so it can only be archived. Archived habits stop appearing for review but keep their history.`
                  : "It has no history yet, so nothing is lost. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {logs.isSuccess && hasHistory && <AlertDialogAction onClick={onArchive}>Archive</AlertDialogAction>}
          {logs.isSuccess && !hasHistory && (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
