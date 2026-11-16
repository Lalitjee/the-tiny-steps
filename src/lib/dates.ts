import { format, parseISO } from "date-fns";

const TZ = "Asia/Kolkata";

/** Today's date in India time as YYYY-MM-DD (matches the database's rw_today()). */
export function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Add (or subtract) days to a YYYY-MM-DD string. */
export function addDays(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type RangePreset = "month" | "7d" | "30d" | "all" | "custom";

export const presetLabels: Record<RangePreset, string> = {
  month: "This month",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
  custom: "Custom range",
};

export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): { from?: string; to?: string } {
  switch (preset) {
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "all":
      return {};
  }
}

export function dayLabel(s: string, today: string): string {
  if (s === today) return "Today";
  if (s === addDays(today, -1)) return "Yesterday";
  return format(parseISO(s), "EEE, d MMM yyyy");
}

export function shortDate(s: string): string {
  return format(parseISO(s), "d MMM yyyy");
}
