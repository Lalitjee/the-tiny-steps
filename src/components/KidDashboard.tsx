import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Minus, MoreVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import type { Database } from "@/integrations/supabase/types";
import { addDays, dayLabel, presetLabels, presetRange, todayIST, type RangePreset } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { PointsDialog, type EditableTx } from "@/components/PointsDialog";

type Tx = Database["public"]["Tables"]["rw_transactions"]["Row"];
const ROW_LIMIT = 1000;

export function KidDashboard({ kidId }: { kidId: string }) {
  const { familyId, userId, isParent } = useFamily();
  const qc = useQueryClient();
  const today = todayIST();

  const [preset, setPreset] = useState<RangePreset>("month");
  const [customFrom, setCustomFrom] = useState(addDays(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const range = preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset, today);

  const [dialog, setDialog] = useState<{ mode: "add" | "deduct"; editing: EditableTx | null } | null>(null);
  const [toDelete, setToDelete] = useState<Tx | null>(null);

  const totals = useQuery({
    queryKey: ["kid-totals", kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rw_kid_totals")
        .select("kid_id, name, balance, total_earned, total_deducted")
        .eq("kid_id", kidId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const txs = useQuery({
    queryKey: ["txs", kidId, range.from ?? null, range.to ?? null],
    queryFn: async () => {
      let q = supabase.from("rw_transactions").select("*").eq("kid_id", kidId);
      if (range.from) q = q.gte("occurred_on", range.from);
      if (range.to) q = q.lte("occurred_on", range.to);
      const { data, error } = await q
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["txs", kidId] });
    qc.invalidateQueries({ queryKey: ["kid-totals", kidId] });
    qc.invalidateQueries({ queryKey: ["kids", familyId] });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rw_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = useMemo(() => {
    const rows = txs.data ?? [];
    const earned = rows.reduce((s, t) => s + (t.points > 0 ? t.points : 0), 0);
    const deducted = rows.reduce((s, t) => s + (t.points < 0 ? -t.points : 0), 0);
    return { earned, deducted, net: earned - deducted };
  }, [txs.data]);

  const groups = useMemo(() => {
    const out: { date: string; items: Tx[] }[] = [];
    for (const t of txs.data ?? []) {
      const last = out[out.length - 1];
      if (last && last.date === t.occurred_on) last.items.push(t);
      else out.push({ date: t.occurred_on, items: [t] });
    }
    return out;
  }, [txs.data]);

  if (totals.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (totals.isError) {
    return <Card className="p-4 text-sm text-destructive">Couldn't load this child: {totals.error.message}</Card>;
  }
  if (!totals.data) {
    return (
      <div className="space-y-3">
        <BackLink />
        <Card className="p-6 text-center text-muted-foreground">This child wasn't found.</Card>
      </div>
    );
  }
  const kid = totals.data;

  return (
    <div className="space-y-5">
      <BackLink />

      {/* Balance */}
      <Card className="p-5 text-center shadow-card">
        <div className="text-sm font-medium text-muted-foreground">{kid.name}'s stars</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-5xl font-bold tabular-nums">
          <Star className="h-10 w-10 fill-star text-star" />
          {kid.balance}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          All time: <span className="text-earn">+{kid.total_earned}</span>
          {kid.total_deducted > 0 && <span className="text-deduct"> · −{kid.total_deducted}</span>}
        </div>

        {isParent && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => setDialog({ mode: "add", editing: null })}>
              <Plus className="mr-1 h-5 w-5" /> Add points
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setDialog({ mode: "deduct", editing: null })}
            >
              <Minus className="mr-1 h-5 w-5" /> Deduct
            </Button>
          </div>
        )}
      </Card>

      {/* Date range */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Period</h2>
          <div className="flex-1" />
          <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
            <SelectTrigger className="w-44" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(presetLabels) as RangePreset[]).map((p) => (
                <SelectItem key={p} value={p}>{presetLabels[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input id="from" type="date" max={customTo} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input id="to" type="date" min={customFrom} max={today} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Earned" value={`+${summary.earned}`} tone="earn" />
          <Stat label="Deducted" value={summary.deducted > 0 ? `−${summary.deducted}` : "0"} tone="deduct" />
          <Stat label="Net" value={`${summary.net > 0 ? "+" : summary.net < 0 ? "−" : ""}${Math.abs(summary.net)}`} />
        </div>
      </section>

      {/* Transactions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Transactions</h2>
        {txs.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : txs.isError ? (
          <Card className="p-4 text-sm text-destructive">Couldn't load transactions: {txs.error.message}</Card>
        ) : groups.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No entries in this period.</Card>
        ) : (
          <>
            {groups.map((g) => (
              <div key={g.date} className="space-y-1.5">
                <div className="px-1 text-xs font-medium text-muted-foreground">{dayLabel(g.date, today)}</div>
                <Card className="divide-y">
                  {g.items.map((t) => (
                    <TxRow
                      key={t.id}
                      tx={t}
                      canEdit={isParent}
                      onEdit={() =>
                        setDialog({
                          mode: t.points < 0 ? "deduct" : "add",
                          editing: { id: t.id, points: t.points, reason: t.reason, occurred_on: t.occurred_on },
                        })
                      }
                      onDelete={() => setToDelete(t)}
                    />
                  ))}
                </Card>
              </div>
            ))}
            {(txs.data?.length ?? 0) >= ROW_LIMIT && (
              <p className="text-center text-xs text-muted-foreground">
                Showing the latest {ROW_LIMIT} entries. Choose a shorter period to see the rest.
              </p>
            )}
          </>
        )}
      </section>

      {isParent && dialog && (
        <PointsDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          kidId={kidId}
          kidName={kid.name}
          userId={userId}
          mode={dialog.mode}
          editing={dialog.editing}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `"${toDelete.reason}" (${toDelete.points > 0 ? "+" : "−"}${Math.abs(toDelete.points)}) will be removed and the balance will change.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Kids
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "earn" | "deduct" }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "mt-0.5 text-xl font-bold tabular-nums " + (tone === "earn" ? "text-earn" : tone === "deduct" ? "text-deduct" : "")
        }
      >
        {value}
      </div>
    </Card>
  );
}

function TxRow({
  tx,
  canEdit,
  onEdit,
  onDelete,
}: {
  tx: Tx;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const positive = tx.points > 0;
  const isHabit = tx.source === "habit";
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium">{tx.reason}</div>
        {isHabit && <div className="text-xs text-muted-foreground">Habit</div>}
      </div>
      <div className={"text-lg font-bold tabular-nums " + (positive ? "text-earn" : "text-deduct")}>
        {positive ? "+" : "−"}
        {Math.abs(tx.points)}
      </div>
      {canEdit && !isHabit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Entry options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
