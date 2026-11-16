import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayIST } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type EditableTx = { id: string; points: number; reason: string; occurred_on: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kidId: string;
  kidName: string;
  userId: string;
  /** "add" or "deduct" for a new entry; ignored when `editing` is set. */
  mode: "add" | "deduct";
  editing?: EditableTx | null;
  onSaved: () => void;
};

const QUICK_AMOUNTS = [1, 2, 5, 10, 20];

export function PointsDialog(props: Props) {
  const { open, onOpenChange, kidName, editing } = props;
  const isDeduct = editing ? editing.points < 0 : props.mode === "deduct";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit entry" : isDeduct ? `Deduct points from ${kidName}` : `Add points for ${kidName}`}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "To change between add and deduct, delete this entry and add a new one."
              : "A short written reason is required."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form starts fresh each time. */}
        <PointsForm {...props} isDeduct={isDeduct} />
      </DialogContent>
    </Dialog>
  );
}

function PointsForm({
  kidId,
  userId,
  editing,
  isDeduct,
  onOpenChange,
  onSaved,
}: Props & { isDeduct: boolean }) {
  const today = todayIST();
  const [amount, setAmount] = useState(editing ? String(Math.abs(editing.points)) : "");
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [date, setDate] = useState(editing?.occurred_on ?? today);

  const n = Number(amount);
  const validAmount = Number.isInteger(n) && n >= 1 && n <= 100000;
  const valid = validAmount && reason.trim().length > 0 && date !== "" && date <= today;

  const save = useMutation({
    mutationFn: async () => {
      const points = (isDeduct ? -1 : 1) * n;
      if (editing) {
        const { error } = await supabase
          .from("rw_transactions")
          .update({ points, reason: reason.trim(), occurred_on: date })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rw_transactions")
          .insert({ kid_id: kidId, points, reason: reason.trim(), occurred_on: date, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Entry updated" : isDeduct ? "Points deducted" : "Points added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <div>
        <Label htmlFor="pts-amount" className="text-xs">Points</Label>
        <Input
          id="pts-amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          placeholder="How many?"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          required
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                amount === String(q) ? "border-primary bg-accent text-accent-foreground" : "hover:bg-accent",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="pts-reason" className="text-xs">Reason</Label>
        <Input
          id="pts-reason"
          placeholder={isDeduct ? "e.g. Threw food on the floor" : "e.g. Shared toys nicely"}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="pts-date" className="text-xs">Date</Label>
        <Input id="pts-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <Button
        type="submit"
        className={cn("w-full", isDeduct && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
        disabled={!valid || save.isPending}
      >
        {save.isPending ? "Saving…" : editing ? "Save changes" : isDeduct ? "Deduct points" : "Add points"}
      </Button>
    </form>
  );
}
