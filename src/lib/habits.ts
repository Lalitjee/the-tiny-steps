import { format, parseISO } from "date-fns";
import type { Frequency } from "@/integrations/supabase/types";
import { dayLabel } from "@/lib/dates";

export const frequencyLabels: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const frequencyHints: Record<Frequency, string> = {
  daily: "Once every day",
  weekly: "Once a week (Monday to Sunday)",
  monthly: "Once a month",
};

export const frequencyOrder: Record<Frequency, number> = { daily: 0, weekly: 1, monthly: 2 };

/** Heading for a habit period, e.g. "Today", "Week of 10 Nov – 16 Nov", "November 2026". */
export function periodLabel(freq: Frequency, start: string, end: string, today: string): string {
  if (freq === "daily") return dayLabel(start, today);
  if (freq === "weekly") {
    const base = `Week of ${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM")}`;
    return start <= today && today <= end ? `${base} (this week)` : base;
  }
  const base = format(parseISO(start), "MMMM yyyy");
  return start <= today && today <= end ? `${base} (this month)` : base;
}

/** Short label for one reviewed period in the history list. */
export function periodShort(freq: Frequency, start: string): string {
  if (freq === "daily") return format(parseISO(start), "EEE, d MMM");
  if (freq === "weekly") return `Week of ${format(parseISO(start), "d MMM")}`;
  return format(parseISO(start), "MMM yyyy");
}

/** Supabase embeds can come back as an object or a one-item array depending on typing. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
