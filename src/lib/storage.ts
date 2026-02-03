// /Users/shoham/Desktop/routine/src/lib/storage.ts

import type {
  Category,
  Goal,
  Timeframe,
  DurationUnit,
  GoalStatus,
} from "@/lib/types";
import { defaultCategories } from "@/lib/types";
import { formatISODate } from "@/lib/date";

export type StoredState = {
  categories: Category[];
  goals: Goal[];
};

const STORAGE_KEY = "routine.state.v1";

/* -------------------- helpers -------------------- */

function isTimeframe(x: any): x is Timeframe {
  return x === "daily" || x === "weekly" || x === "monthly" || x === "yearly";
}

function isDurationUnit(x: any): x is DurationUnit {
  return x === "hours" || x === "days" || x === "weeks" || x === "months";
}

function normalizeStatus(x: any): GoalStatus {
  if (x === "DONE") return "DONE";
  if (x === "FUTURE") return "FUTURE";
  return "IN_PROGRESS";
}

function timeframeDefaults(tf: Timeframe): { unit: DurationUnit; value: number } {
  if (tf === "daily") return { unit: "hours", value: 24 };
  if (tf === "weekly") return { unit: "days", value: 7 };
  if (tf === "monthly") return { unit: "weeks", value: 4 };
  return { unit: "months", value: 12 };
}

/* -------------------- categories policy -------------------- */

/**
 * תמיד רק 5 קטגוריות קבועות (כמו ב-defaultCategories).
 * זה מונע מצב שיש 7/8 בגלל היסטוריה ב-localStorage.
 */
const ALLOWED_CATEGORY_IDS = new Set(defaultCategories.map((c) => c.id));

/**
 * מיפוי ids ישנים לחדשים (כדי לא לאבד goals ישנים)
 * אפשר להוסיף פה עוד לפי מה שהיה אצלך פעם.
 */
const CATEGORY_ID_MIGRATION: Record<string, string> = {
  // בית
  chores: "home",
  house: "home",
  home_chores: "home",

  // עבודה
  job: "work",
  office: "work",

  // בריאות וכושר (מאוחד)
  fitness: "health",
  sport: "health",
  gym: "health",
  training: "health",
  health_fitness: "health",

  // למידה ופנאי (במקום לימודים)
  learning: "study",
  learn: "study",
  leisure: "study",
  hobby: "study",
  topic: "study",
  subject: "study",

  // שמירת קשר / חברים / סושיאל וכו' -> other
  friends: "other",
  social: "other",
  relationships: "other",
  contact: "other",
  networking: "other",

  misc: "other",
};

function sanitizeCategories(_input: any): { categories: Category[]; changed: boolean } {
  // תמיד נכפה את 5 קטגוריות ברירת המחדל
  return { categories: defaultCategories, changed: true };
}

/* -------------------- goals migrate/sanitize -------------------- */

function normalizeCategoryId(rawId: any): { id: string; changed: boolean } {
  const original =
    typeof rawId === "string" && rawId.trim().length > 0 ? rawId.trim() : "other";

  let id = original;

  const mapped = CATEGORY_ID_MIGRATION[id];
  if (mapped) id = mapped;

  if (!ALLOWED_CATEGORY_IDS.has(id)) id = "other";

  return { id, changed: id !== original };
}

function migrateGoal(raw: any): { goal: Goal | null; changed: boolean } {
  if (!raw || typeof raw !== "object") return { goal: null, changed: true };

  let changed = false;

  const timeframe: Timeframe = isTimeframe(raw.timeframe) ? raw.timeframe : "daily";
  if (raw.timeframe !== timeframe) changed = true;

  const id =
  typeof raw.id === "string" && raw.id.trim().length > 0
    ? raw.id
    : crypto?.randomUUID?.() ?? String(Math.random());

  if (raw.id !== id) changed = true;

  const title = typeof raw.title === "string" ? raw.title : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  if (typeof raw.title !== "string") changed = true;

  const cat = normalizeCategoryId(raw.categoryId);
  if (cat.changed) changed = true;

  // NEW fields preferred
  let startAt: string | null =
    typeof raw.startAt === "string" && raw.startAt.includes("T") ? raw.startAt : null;

  let endAt: string | null =
    typeof raw.endAt === "string" && raw.endAt.includes("T") ? raw.endAt : null;

  // legacy date-only fallback
  const legacyStartDate =
    typeof raw.startDate === "string" && raw.startDate.length >= 10 ? raw.startDate : null;

  const legacyEndDate =
    typeof raw.endDate === "string" && raw.endDate.length >= 10 ? raw.endDate : null;

  if (!startAt) {
    const d = legacyStartDate ?? formatISODate(new Date());
    startAt = `${d}T00:00`;
    changed = true;
  }

  const def = timeframeDefaults(timeframe);

  const durationUnit: DurationUnit = isDurationUnit(raw.durationUnit) ? raw.durationUnit : def.unit;
  if (raw.durationUnit !== durationUnit) changed = true;

  const durationValue: number =
    typeof raw.durationValue === "number" && Number.isFinite(raw.durationValue)
      ? raw.durationValue
      : def.value;
  if (raw.durationValue !== durationValue) changed = true;

  if (!endAt) {
    if (legacyEndDate) {
      endAt = `${legacyEndDate}T00:00`;
      changed = true;
    } else {
      endAt = startAt;
      changed = true;
    }
  }

  const createdAt =
    typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  if (raw.createdAt !== createdAt) changed = true;

  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
  if (raw.updatedAt !== updatedAt) changed = true;

  const status = normalizeStatus(raw.status);
  if (raw.status !== status) changed = true;

  const goal: Goal = {
    id,
    title,
    description,
    timeframe,
    categoryId: cat.id,
    startAt,
    endAt,
    durationUnit,
    durationValue,
    status,
    createdAt,
    updatedAt,
    startDate: typeof raw.startDate === "string" ? raw.startDate : undefined,
    endDate: typeof raw.endDate === "string" ? raw.endDate : undefined,
  };

  return { goal, changed };
}

function sanitizeGoals(input: any): { goals: Goal[]; changed: boolean } {
  if (!Array.isArray(input)) return { goals: [], changed: false };

  let changed = false;
  const out: Goal[] = [];

  for (const raw of input) {
    const m = migrateGoal(raw);
    if (!m.goal) {
      changed = true;
      continue;
    }
    if (m.changed) changed = true;
    out.push(m.goal);
  }

  return { goals: out, changed };
}

/* -------------------- API -------------------- */

export function loadState(): StoredState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    const catRes = sanitizeCategories(parsed?.categories);
    const goalsRes = sanitizeGoals(parsed?.goals);

    const state: StoredState = {
      categories: catRes.categories,
      goals: goalsRes.goals,
    };

    // תמיד נכתוב חזרה פעם אחת כדי לנקות ל-5 קטגוריות + לתקן goals
    if (catRes.changed || goalsRes.changed) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }

    return state;
  } catch (err) {
    console.warn("loadState: bad JSON in localStorage, resetting", err);
    return null;
  }
}

export function saveState(state: StoredState) {
  if (typeof window === "undefined") return;

  const safe: StoredState = {
    // enforce 5 categories only
    categories: defaultCategories,
    goals: Array.isArray(state.goals) ? state.goals : [],
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch (err) {
    console.warn("saveState failed", err);
  }
}

export function clearState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
