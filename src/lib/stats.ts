// /Users/shoham/Desktop/routine/src/lib/stats.ts

import { Goal, Timeframe } from "@/lib/types";

export type GoalStats = { open: number; done: number };

export function computeStats(goals: Goal[], timeframe: Timeframe): GoalStats {
  let open = 0;
  let done = 0;

  for (const g of goals) {
    if (g.timeframe !== timeframe) continue;
    if (g.status === "DONE") done++;
    else open++;
  }

  return { open, done };
}

/* -------------------- Home Stats -------------------- */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekSunday(d: Date) {
  // שבוע שמתחיל יום ראשון (מתאים לישראל)
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - day);
  return x;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

/**
 * ✅ סטטיסטיקה לדף הבית:
 * - doneToday: כמה הושלמו היום
 * - doneThisWeek: כמה הושלמו השבוע (משבוע שמתחיל ראשון)
 * - streakDays: רצף ימים אחורה (כולל היום) שבהם הושלמה לפחות מטרה אחת
 *
 * תאימות לאחור:
 * אם DONE ואין doneAt, נופלים ל-updatedAt/createdAt.
 */
export function computeHomeStats(goals: Goal[]) {
  const now = new Date();
  const sow = startOfWeekSunday(now);

  const doneGoals = goals.filter((g) => g.status === "DONE");

  // Map "YYYY-MM-DD" -> count
  const doneByDate = new Map<string, number>();

  for (const g of doneGoals) {
    const ts =
      typeof g.doneAt === "number"
        ? g.doneAt
        : typeof g.updatedAt === "number"
        ? g.updatedAt
        : typeof g.createdAt === "number"
        ? g.createdAt
        : Date.now();

    const d = new Date(ts);
    const key = dayKey(d);
    doneByDate.set(key, (doneByDate.get(key) ?? 0) + 1);
  }

  const todayKey = dayKey(now);
  const doneToday = doneByDate.get(todayKey) ?? 0;

  // done this week
  let doneThisWeek = 0;
  for (const [k, count] of doneByDate.entries()) {
    const d = new Date(k + "T00:00:00");
    if (d >= sow && d <= now) doneThisWeek += count;
  }

  // streak
  let streakDays = 0;
  let cursor = startOfDay(now);

  for (let i = 0; i < 3650; i++) {
    const key = dayKey(cursor);
    if ((doneByDate.get(key) ?? 0) > 0) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { doneToday, doneThisWeek, streakDays };
}
