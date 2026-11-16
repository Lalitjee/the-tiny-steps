import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, PartyPopper, Star, Undo2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import { todayIST } from "@/lib/dates";
import { frequencyOrder, one, periodLabel, periodShort } from "@/lib/habits";
import type { Frequency } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WINDOW_DAYS = 30;

type Pending = {
  habit_id: string;
  kid_id: string;
  kid_name: string;
  habit_name: string;
  points: number;
  frequency: Frequency;
  period_start: string;
  period_end: string;
};

export function HabitReview({ kids }: { kids: { id: string; name: string }[] }) {
  const { familyId } = useFamily();
  const qc = useQueryClient();
  const today = todayIST();
  const [kidFilter, setKidFilter] = useState("all");

  const pending = useQuery({
    queryKey: ["pending-habits", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rw_pending_habits", { p_days: WINDOW_DAYS });
      if (error) throw error;
      return data as Pending[];
    },
  });

  const history = useQuery({
    queryKey: ["habit-history", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rw_habit_logs")
        .select("id, period_start, status, points, reviewed_at, rw_habits(name, frequency, kid_id, rw_kids(name))")
        .order("reviewed_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pending-habits", familyId] });
    qc.invalidateQueries({ queryKey: ["habit-history", familyId] });
    qc.invalidateQueries({ queryKey: ["kid-totals"] });
    qc.invalidateQueries({ queryKey: ["kids", familyId] });
    qc.invalidateQueries({ queryKey: ["txs"] });
  };

  const undo = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from("rw_habit_logs").delete().eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Undone");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async (v: { item: Pending; status: "done" | "not_done" }) => {
      const { data, error } = await supabase.rpc("rw_review_habit", {
        p_habit_id: v.item.habit_id,
        p_period_start: v.item.period_start,
        p_status: v.status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (logId, v) => {
      const msg =
        v.status === "done"
          ? `+${v.item.points} for ${v.item.kid_name}: ${v.item.habit_name}`
          : `Marked not done: ${v.item.habit_name} (${v.item.kid_name})`;
      toast.success(msg, { action: { label: "Undo", onClick: () => undo.mutate(logId) } });
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  const groups = useMemo(() => {
    const rows = (pending.data ?? []).filter((r) => kidFilter === "all" || r.kid_id === kidFilter);
    rows.sort(
      (a, b) =>
        b.period_start.localeCompare(a.period_start) ||
        frequencyOrder[a.frequency] - frequencyOrder[b.frequency] ||
        a.kid_name.localeCompare(b.kid_name) ||
        a.habit_name.localeCompare(b.habit_name),
    );
    const out: { key: string; label: string; items: Pending[] }[] = [];
    for (const r of rows) {
      const key = `${r.frequency}|${r.period_start}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(r);
      else out.push({ key, label: periodLabel(r.frequency, r.period_start, r.period_end, today), items: [r] });
    }
    return out;
  }, [pending.data, kidFilter, today]);

  const historyRows = useMemo(() => {
    return (history.data ?? [])
      .map((l) => {
        const h = one(l.rw_habits);
        const k = h ? one(h.rw_kids) : null;
        return { ...l, habit: h, kidName: k?.name ?? "" };
      })
      .filter((l) => l.habit && (kidFilter === "all" || l.habit.kid_id === kidFilter));
  }, [history.data, kidFilter]);

  const busy = review.isPending || undo.isPending;
  const showKidName = kidFilter === "all" && kids.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Habits from the last {WINDOW_DAYS} days waiting for your review.
        </p>
        {kids.length > 1 && (
          <Select value={kidFilter} onValueChange={setKidFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by child">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kids</SelectItem>
              {kids.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Pending */}
      <section className="space-y-4">
        {pending.isPending ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : pending.isError ? (
          <Card className="p-4 text-sm text-destructive">Couldn't load habits: {pending.error.message}</Card>
        ) : groups.length === 0 ? (
          <Card className="p-6 text-center">
            <PartyPopper className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="font-medium">All caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing to review. Add habits on the Manage tab and they'll show up here.
            </p>
          </Card>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <div className="px-1 text-xs font-medium text-muted-foreground">{g.label}</div>
              <Card className="divide-y">
                {g.items.map((it) => (
                  <div key={`${it.habit_id}|${it.period_start}`} className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-medium">{it.habit_name}</div>
                        {showKidName && <div className="text-xs text-muted-foreground">{it.kid_name}</div>}
                      </div>
                      <div className="flex items-center gap-1 font-bold tabular-nums text-earn">
                        <Star className="h-4 w-4 fill-star text-star" />+{it.points}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        disabled={busy}
                        onClick={() => review.mutate({ item: it, status: "done" })}
                        aria-label={`Done: ${it.habit_name}`}
                      >
                        <Check className="mr-1 h-4 w-4" /> Done
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => review.mutate({ item: it, status: "not_done" })}
                        aria-label={`Not done: ${it.habit_name}`}
                      >
                        <X className="mr-1 h-4 w-4" /> Not done
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))
        )}
      </section>

      {/* History */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Recently reviewed</h2>
        {history.isPending ? null : history.isError ? (
          <Card className="p-4 text-sm text-destructive">Couldn't load history: {history.error.message}</Card>
        ) : historyRows.length === 0 ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Nothing reviewed yet.</Card>
        ) : (
          <Card className="divide-y">
            {historyRows.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{l.habit!.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {kids.length > 1 && l.kidName ? `${l.kidName} · ` : ""}
                    {periodShort(l.habit!.frequency, l.period_start)}
                  </div>
                </div>
                {l.status === "done" ? (
                  <span className="font-bold tabular-nums text-earn">+{l.points}</span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">Not done</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => undo.mutate(l.id)}
                  aria-label={`Undo ${l.habit!.name}`}
                >
                  <Undo2 className="mr-1 h-4 w-4" /> Undo
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
