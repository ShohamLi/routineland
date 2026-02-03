// /Users/shoham/Desktop/routine/src/lib/types.ts

export type Timeframe = "daily" | "weekly" | "monthly" | "yearly";

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  daily: "מטרות יומיות",
  weekly: "מטרות שבועיות",
  monthly: "מטרות חודשיות",
  yearly: "מטרות שנתיות",
};

export function isTimeframe(x: string): x is Timeframe {
  return x === "daily" || x === "weekly" || x === "monthly" || x === "yearly";
}

/* -------------------- Goal status -------------------- */

export type GoalStatus = "FUTURE" | "IN_PROGRESS" | "DONE";

/* -------------------- Duration -------------------- */

export type DurationUnit = "hours" | "days" | "weeks" | "months";

/* -------------------- Category -------------------- */

export type Category = {
  id: string;
  nameHe: string;
  color: string;
};

/* -------------------- Goal -------------------- */

export type Goal = {
  id: string;
  title: string;
  description?: string;

  timeframe: Timeframe;
  categoryId: string;

  // full local datetime: "YYYY-MM-DDTHH:MM"
  startAt: string;
  endAt: string;

  durationValue: number;
  durationUnit: DurationUnit;

  // נשמר רק DONE ידני. FUTURE / IN_PROGRESS נגזרים בזמן ריצה.
  status: GoalStatus;

  // ✅ חדש: מתי סומן DONE (timestamp)
  // משמש לסטטיסטיקות: רצף / היום / השבוע
  doneAt?: number;

  createdAt: number;
  updatedAt: number;

  // תאימות לאחור לנתונים ישנים
  startDate?: string;
  endDate?: string;
};

/* -------------------- Defaults -------------------- */
/**
 * חשוב: משאירים את ה-ids כמו שהיו (home/work/health/study/other)
 * כדי לא לשבור goals קיימים. רק משנים שמות.
 */
export const defaultCategories: Category[] = [
  { id: "home", nameHe: "מטלות בית", color: "#60A5FA" },
  { id: "work", nameHe: "עבודה", color: "#34D399" },
  { id: "health", nameHe: "בריאות וכושר", color: "#F87171" },
  { id: "study", nameHe: "למידה ופנאי", color: "#FBBF24" },
  { id: "other", nameHe: "אחר", color: "#A78BFA" },
];
