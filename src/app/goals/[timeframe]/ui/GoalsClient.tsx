"use client";

import AnimatedBackground from "@/components/AnimatedBackground";
import Toast from "@/components/Toast";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { loadGoalsUiPrefs, saveGoalsUiPrefs } from "@/lib/uiPrefs";
import {
  Category,
  Goal,
  Timeframe,
  TIMEFRAME_LABELS,
  defaultCategories,
  DurationUnit,
  GoalStatus,
} from "@/lib/types";
import { loadState, saveState } from "@/lib/storage";
import {
  addDays,
  addHours,
  addMonths,
  formatISODate,
  formatISOLocalDateTime,
  parseLocalDateTime,
} from "@/lib/date";

type StoredState = {
  categories: Category[];
  goals: Goal[];
};

function sortCategoriesHe(arr: Category[]) {
  return [...arr].sort((a, b) => a.nameHe.localeCompare(b.nameHe, "he"));
}

function timeframeDurationConfig(tf: Timeframe) {
  if (tf === "daily") return { unit: "hours" as const, min: 0, max: 24, label: "שעות" };
  if (tf === "weekly") return { unit: "days" as const, min: 1, max: 7, label: "ימים" };
  if (tf === "monthly") return { unit: "days" as const, min: 1, max: 31, label: "ימים" };
  return { unit: "months" as const, min: 1, max: 12, label: "חודשים" };
}

const UNIT_HE: Record<DurationUnit, string> = {
  hours: "שעות",
  days: "ימים",
  weeks: "שבועות",
  months: "חודשים",
};

function computeEndAt(startAtISO: string, unit: DurationUnit, value: number) {
  const start = parseLocalDateTime(startAtISO);
  if (unit === "hours") return formatISOLocalDateTime(addHours(start, value));
  if (unit === "days") return formatISOLocalDateTime(addDays(start, value));
  if (unit === "weeks") return formatISOLocalDateTime(addDays(start, value * 7));
  return formatISOLocalDateTime(addMonths(start, value));
}

function deriveStatus(now: Date, g: Goal): GoalStatus {
  if (g.status === "DONE") return "DONE";
  const startAt = parseLocalDateTime(g.startAt);
  if (now < startAt) return "FUTURE";
  return "IN_PROGRESS";
}

function migrateGoalIfNeeded(raw: any): Goal {
  // ✅ אם כבר מבנה חדש: רק ננקה doneAt
  if (raw?.startAt && raw?.endAt && raw?.durationUnit && typeof raw?.durationValue === "number") {
    return {
      ...raw,
      doneAt: typeof raw?.doneAt === "number" ? raw.doneAt : undefined,
    } as Goal;
  }

  // תאימות לאחור
  const startDate = typeof raw?.startDate === "string" ? raw.startDate : formatISODate(new Date());
  const endDate = typeof raw?.endDate === "string" ? raw.endDate : startDate;

  const startAt = `${startDate}T00:00`;
  const endAt = `${endDate}T00:00`;

  const tf: Timeframe = raw?.timeframe ?? "daily";
  const cfg = timeframeDurationConfig(tf);

  let durationUnit: DurationUnit = cfg.unit;
  let durationValue = cfg.min;

  if (tf === "daily") {
    durationUnit = "hours";
    durationValue = 24;
  } else if (tf === "weekly") {
    durationUnit = "days";
    durationValue = 7;
  } else if (tf === "monthly") {
    durationUnit = "days";
    durationValue = 30;
  } else {
    durationUnit = "months";
    durationValue = 12;
  }

  return {
    ...raw,
    startAt,
    endAt,
    durationUnit,
    durationValue,
    doneAt: typeof raw?.doneAt === "number" ? raw.doneAt : undefined,
  } as Goal;
}

function getInitialData(timeframe: Timeframe) {
  const loaded = loadState();

  const categories = loaded?.categories?.length ? loaded.categories : defaultCategories;
  const sortedCategories = sortCategoriesHe(categories);

  const goalsRaw = loaded?.goals ?? [];
  const goals = goalsRaw.map(migrateGoalIfNeeded);

  const prefs = loadGoalsUiPrefs(timeframe);

  const fallbackCategory = sortedCategories[0]?.id ?? "home";

  const nextCategoryId =
    prefs?.categoryId && sortedCategories.some((c) => c.id === prefs.categoryId)
      ? prefs.categoryId
      : fallbackCategory;

  const nextCategoryFilter =
    prefs?.categoryFilter === "all" ||
    (prefs?.categoryFilter && sortedCategories.some((c) => c.id === prefs.categoryFilter))
      ? (prefs?.categoryFilter ?? "all")
      : "all";

  return {
    categories,
    sortedCategories,
    goals,
    nextCategoryId,
    nextCategoryFilter,
    nextQuery: prefs?.query ?? "",
  };
}

/* -------------------- Portal Modal (Stable input focus) -------------------- */
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative mx-auto mt-10 w-[min(980px,92vw)] rounded-3xl border border-black/10 bg-white/95 p-6 md:p-8 shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-zinc-950">{title}</div>

          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-900 hover:bg-zinc-50"
            aria-label="סגור"
            title="סגור"
          >
            סגור
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function GoalsClient({ timeframe }: { timeframe: Timeframe }) {
  const [toast, setToast] = useState<string | null>(null);

  const [state, setState] = useState<StoredState>({
    categories: defaultCategories,
    goals: [],
  });

  const [ready, setReady] = useState(false);
  const [lastSaved, setLastSaved] = useState("");

  const header = TIMEFRAME_LABELS[timeframe];
  const cfg = timeframeDurationConfig(timeframe);

  // Add form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("home");
  const [startDate, setStartDate] = useState(formatISODate(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [durationValueStr, setDurationValueStr] = useState<string>(""); // ריק במקום 0

  const startAt = useMemo(() => `${startDate}T${startTime}`, [startDate, startTime]);

  const endAt = useMemo(() => {
    const v = durationValueStr.trim();
    if (v === "") return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return computeEndAt(startAt, cfg.unit, n);
  }, [startAt, cfg.unit, durationValueStr]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const sortedCategories = useMemo(() => sortCategoriesHe(state.categories), [state.categories]);

  // Mobile: Add modal
  const [addOpen, setAddOpen] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("home");
  const [editStartDate, setEditStartDate] = useState(formatISODate(new Date()));
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editDurationValueStr, setEditDurationValueStr] = useState<string>("");

  const editStartAt = useMemo(
    () => `${editStartDate}T${editStartTime}`,
    [editStartDate, editStartTime]
  );

  const editEndAt = useMemo(() => {
    const v = editDurationValueStr.trim();
    if (v === "") return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return computeEndAt(editStartAt, cfg.unit, n);
  }, [editStartAt, cfg.unit, editDurationValueStr]);

  useEffect(() => {
    setReady(false);

    const data = getInitialData(timeframe);
    setState({ categories: data.categories, goals: data.goals });
    setCategoryId(data.nextCategoryId);

    setCategoryFilter("all");
    setQuery("");

    setTitle("");
    setStartDate(formatISODate(new Date()));
    setStartTime("09:00");
    setDurationValueStr("");

    setAddOpen(false);

    // Reset edit
    setEditOpen(false);
    setEditingId(null);

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  useEffect(() => {
    if (!ready) return;

    const next = JSON.stringify(state);
    if (next === lastSaved) return;

    saveState(state);
    setLastSaved(next);
  }, [ready, state, lastSaved]);

  useEffect(() => {
    if (!ready) return;

    const t = window.setTimeout(() => {
      saveGoalsUiPrefs(timeframe, { categoryId, categoryFilter, query });
    }, 250);

    return () => window.clearTimeout(t);
  }, [ready, timeframe, categoryId, categoryFilter, query]);

  const goalsForTimeframe = useMemo(() => {
    return state.goals.filter((g) => g.timeframe === timeframe);
  }, [state.goals, timeframe]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return goalsForTimeframe.filter((g) => {
      const matchesCategory = categoryFilter === "all" ? true : g.categoryId === categoryFilter;
      const matchesQuery =
        q.length === 0 ? true : (g.title + " " + (g.description ?? "")).toLowerCase().includes(q);

      return matchesCategory && matchesQuery;
    });
  }, [goalsForTimeframe, categoryFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of filtered) {
      const arr = map.get(g.categoryId) ?? [];
      arr.push(g);
      map.set(g.categoryId, arr);
    }

    // ✅ מיון: בתהליך -> עתידי -> הושלם, ואז לפי זמן התחלה
    const rank: Record<GoalStatus, number> = {
      IN_PROGRESS: 0,
      FUTURE: 1,
      DONE: 2,
    };

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const now = new Date();
        const sa = deriveStatus(now, a);
        const sb = deriveStatus(now, b);

        if (sa !== sb) return rank[sa] - rank[sb];
        return a.startAt.localeCompare(b.startAt);
      });
      map.set(k, arr);
    }

    return map;
  }, [filtered]);

  const activeGroups = useMemo(() => {
    if (categoryFilter !== "all") {
      const goals = grouped.get(categoryFilter);
      return goals && goals.length > 0 ? [[categoryFilter, goals] as const] : [];
    }
    return Array.from(grouped.entries()).filter(([, goals]) => goals.length > 0);
  }, [grouped, categoryFilter]);

  function validateDurationOrToast(valueStr: string) {
    const v = valueStr.trim();
    if (v === "") {
      setToast(`תכתוב משך (${cfg.label}).`);
      return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
      setToast("משך חייב להיות מספר.");
      return null;
    }
    if (n < cfg.min || n > cfg.max) {
      setToast(`משך לא תקין. חייב להיות בין ${cfg.min} ל-${cfg.max} (${cfg.label}).`);
      return null;
    }
    return n;
  }

  function addGoal() {
    const clean = title.trim();
    if (!clean) {
      setToast("תן שם למטרה 🙂");
      return;
    }

    const n = validateDurationOrToast(durationValueStr);
    if (n === null) return;

    const now = new Date();
    const startD = parseLocalDateTime(startAt);
    const computedEnd = computeEndAt(startAt, cfg.unit, n);
    const endD = parseLocalDateTime(computedEnd);

    if (!(endD > startD)) {
      setToast("שגיאה: הסיום חייב להיות אחרי ההתחלה.");
      return;
    }

    const initialStatus: GoalStatus = now < startD ? "FUTURE" : "IN_PROGRESS";

    const newGoal: Goal = {
      id: crypto.randomUUID(),
      title: clean,
      description: "",
      timeframe,
      categoryId,
      startAt,
      endAt: computedEnd,
      durationValue: n,
      durationUnit: cfg.unit,
      status: initialStatus,
      doneAt: undefined, // ✅ חדש (ברירת מחדל)
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setState((s) => ({ ...s, goals: [newGoal, ...s.goals] }));
    setTitle("");
    setDurationValueStr("");
    setAddOpen(false);
    setToast("נוספה מטרה ✅");
  }

  function toggleDone(goalId: string) {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;

        const now = Date.now();

        // אם הופכים ל-DONE -> שומרים doneAt
        if (g.status !== "DONE") {
          return { ...g, status: "DONE", doneAt: now, updatedAt: now };
        }

        // אם חוזרים מ-DONE -> מוחקים doneAt
        return { ...g, status: "IN_PROGRESS", doneAt: undefined, updatedAt: now };
      }),
    }));
  }

  function removeGoal(goalId: string) {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== goalId) }));
    setToast("נמחקה מטרה 🗑️");
  }

  function clearFilters() {
    setCategoryFilter("all");
    setQuery("");
    setToast("נוקו פילטרים 🧹");
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id);

    setEditTitle(goal.title ?? "");
    setEditCategoryId(goal.categoryId ?? "home");

    const iso = goal.startAt || `${formatISODate(new Date())}T09:00`;
    const [d, t] = iso.split("T");
    setEditStartDate(d || formatISODate(new Date()));
    setEditStartTime(t || "09:00");

    setEditDurationValueStr(String(goal.durationValue ?? ""));

    setEditOpen(true);
  }

  function saveEdit() {
    if (!editingId) return;

    const clean = editTitle.trim();
    if (!clean) {
      setToast("תן שם למטרה 🙂");
      return;
    }

    const n = validateDurationOrToast(editDurationValueStr);
    if (n === null) return;

    const startD = parseLocalDateTime(editStartAt);
    const computedEnd = computeEndAt(editStartAt, cfg.unit, n);
    const endD = parseLocalDateTime(computedEnd);

    if (!(endD > startD)) {
      setToast("שגיאה: הסיום חייב להיות אחרי ההתחלה.");
      return;
    }

    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== editingId) return g;

        const now = new Date();

        // שומרים DONE ידני, אחרת סטטוס נגזר לפי הזמן
        const nextStatus: GoalStatus =
          g.status === "DONE" ? "DONE" : now < startD ? "FUTURE" : "IN_PROGRESS";

        // ✅ אם זה DONE נשמור doneAt קיים (ואם חסר, נשים עכשיו)
        const nextDoneAt =
          nextStatus === "DONE"
            ? typeof g.doneAt === "number"
              ? g.doneAt
              : Date.now()
            : undefined;

        return {
          ...g,
          title: clean,
          categoryId: editCategoryId,
          startAt: editStartAt,
          endAt: computedEnd,
          durationValue: n,
          durationUnit: cfg.unit,
          status: nextStatus,
          doneAt: nextDoneAt,
          updatedAt: Date.now(),
        };
      }),
    }));

    setEditOpen(false);
    setEditingId(null);
    setToast("עודכן ✅");
  }
function renderAddOrEditForm(mode: "add" | "edit") {
  const isEdit = mode === "edit";

  const vTitle = isEdit ? editTitle : title;
  const vSetTitle = isEdit ? setEditTitle : setTitle;

  const vCategory = isEdit ? editCategoryId : categoryId;
  const vSetCategory = isEdit ? setEditCategoryId : setCategoryId;

  const vStartDate = isEdit ? editStartDate : startDate;
  const vSetStartDate = isEdit ? setEditStartDate : setStartDate;

  const vStartTime = isEdit ? editStartTime : startTime;
  const vSetStartTime = isEdit ? setEditStartTime : setStartTime;

  const vDurationStr = isEdit ? editDurationValueStr : durationValueStr;
  const vSetDurationStr = isEdit ? setEditDurationValueStr : setDurationValueStr;

  const vEndAt = isEdit ? editEndAt : endAt;

  const submit = isEdit ? saveEdit : addGoal;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 md:p-6 shadow-sm">
      <div className="mb-4 text-base font-semibold text-zinc-950">
        {isEdit ? "עריכת מטרה" : `הוסף מטרה (${header})`}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-2">
          <div className="mb-1 text-sm font-medium text-zinc-700">כותרת</div>
          <input
            value={vTitle}
            onChange={(e) => vSetTitle(e.target.value)}
            placeholder={
              timeframe === "daily"
                ? "לדוגמה: ללמוד 2 שעות"
                : timeframe === "weekly"
                ? "לדוגמה: 3 מטלות LeetCode"
                : timeframe === "monthly"
                ? "לדוגמה: 10 ימים רצוף"
                : "לדוגמה: לסיים קורס"
            }
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400"
          />
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-zinc-700">קטגוריה</div>
          <select
            value={vCategory}
            onChange={(e) => vSetCategory(e.target.value)}
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-950 outline-none"
          >
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameHe}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-zinc-700">תאריך התחלה</div>
          <input
            type="date"
            value={vStartDate}
            onChange={(e) => vSetStartDate(e.target.value)}
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-950 outline-none"
          />
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-zinc-700">שעת התחלה</div>
          <input
            type="time"
            value={vStartTime}
            onChange={(e) => vSetStartTime(e.target.value)}
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-950 outline-none"
          />
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-zinc-700">משך ({cfg.label})</div>
          <input
            type="number"
            min={cfg.min}
            max={cfg.max}
            value={vDurationStr}
            onChange={(e) => vSetDurationStr(e.target.value)}
            placeholder="לדוגמה: 2"
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400"
          />
          <div className="mt-2 text-xs text-zinc-500">
            {timeframe === "daily" && "0–24 שעות"}
            {timeframe === "weekly" && "1–7 ימים"}
            {timeframe === "monthly" && "1–31 ימים"}
            {timeframe === "yearly" && "1–12 חודשים"}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-700">
          סיום מחושב:{" "}
          <span className="font-medium text-zinc-950">
            {vEndAt ? vEndAt.replace("T", " ") : "—"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
              }}
              className="h-12 rounded-xl border border-black/10 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"
            >
              ביטול
            </button>
          )}

          <button
            type="button"
            onClick={submit}
            className="h-12 rounded-xl bg-zinc-950 px-6 text-base font-medium text-white hover:bg-zinc-900"
          >
            {isEdit ? "שמור" : "הוסף"}
          </button>
        </div>
      </div>
    </section>
  );
}



  return (
    <main className="min-h-screen text-zinc-950">
      <AnimatedBackground />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/15" />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-600">
              <Link href="/" className="hover:text-zinc-800">
                בית
              </Link>{" "}
              <span className="text-zinc-500">/</span>{" "}
              <span className="text-zinc-800">{header}</span>
            </div>

            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
              {header}{" "}
              <span className="text-base font-normal text-zinc-600">({goalsForTimeframe.length})</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 w-full sm:w-auto rounded-xl border border-black/10 bg-white/80 px-3 text-sm text-zinc-900 outline-none"
              title="סינון קטגוריה"
            >
              <option value="all">כל הקטגוריות</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameHe}
                </option>
              ))}
            </select>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש..."
              className="h-11 w-full sm:w-44 rounded-xl border border-black/10 bg-white/80 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500"
            />

            <button
              onClick={clearFilters}
              className="h-11 w-full sm:w-auto rounded-xl border border-black/10 bg-white/80 px-3 text-sm text-zinc-800 hover:bg-white"
              title="נקה פילטרים"
            >
              נקה
            </button>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="md:hidden h-11 w-full sm:w-auto rounded-xl bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-900"
              title="הוסף מטרה"
            >
              הוסף מטרה
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          {renderAddOrEditForm("add")}

        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/85 p-6 text-zinc-700 shadow-sm backdrop-blur">
            אין מטרות להצגה בטווח הזה. נסה להוסיף מטרה או לנקות פילטרים.
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/85 p-6 text-zinc-700 shadow-sm backdrop-blur">
            אין מטרות בקטגוריה שבחרת (או שהחיפוש סינן הכל). נסה לנקות פילטרים.
          </div>
        ) : (
          <section className="mt-6 space-y-5">
            {activeGroups.map(([catId, goals]) => {
              const cat = state.categories.find((c) => c.id === catId);
              if (!cat) return null;

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-black/10 bg-white/85 p-4 shadow-sm backdrop-blur"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden
                      />
                      <div className="text-sm font-semibold text-zinc-950">{cat.nameHe}</div>
                    </div>
                    <div className="text-xs text-zinc-600">{goals.length} מטרות</div>
                  </div>

                  <div className="grid gap-3">
                    {goals.map((g) => {
                      const st = deriveStatus(new Date(), g);
                      const badge = st === "DONE" ? "הושלם" : st === "FUTURE" ? "עתידי" : "בתהליך";

                      const badgeClass =
                        st === "DONE"
                          ? "text-zinc-700 bg-black/5 border-black/10"
                          : st === "FUTURE"
                          ? "text-zinc-800 bg-black/5 border-black/10"
                          : "text-zinc-900 bg-black/5 border-black/10";

                      const s = parseLocalDateTime(g.startAt);
                      const e = parseLocalDateTime(g.endAt);
                      const from = s <= e ? g.startAt : g.endAt;
                      const to = s <= e ? g.endAt : g.startAt;

                      return (
                        <div
                          key={g.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/70 p-3"
                        >
                          <div className="min-w-[260px]">
                            <div className="flex items-center gap-2">
                              <div
                                className={`text-sm font-medium ${
                                  st === "DONE" ? "text-zinc-500 line-through" : "text-zinc-950"
                                }`}
                              >
                                {g.title}
                              </div>

                              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClass}`}>
                                {badge}
                              </span>
                            </div>

                            <div className="mt-1 text-xs text-zinc-700">
                              {from.replace("T", " ")} ← {to.replace("T", " ")}
                            </div>

                            <div className="mt-1 text-[11px] text-zinc-600">
                              משך: {g.durationValue} {UNIT_HE[g.durationUnit]}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(g)}
                              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-zinc-900 hover:bg-white"
                            >
                              ערוך
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleDone(g.id)}
                              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-zinc-900 hover:bg-white"
                            >
                              {g.status === "DONE" ? "החזר לבתהליך" : "סמן הושלם"}
                            </button>

                            <button
                              type="button"
                              onClick={() => removeGoal(g.id)}
                              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-zinc-900 hover:bg-white"
                              title="מחיקה"
                            >
                              מחק
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <Modal open={addOpen} title={`הוסף מטרה (${header})`} onClose={() => setAddOpen(false)}>
        {renderAddOrEditForm("add")}

      </Modal>

      <Modal
        open={editOpen}
        title="עריכת מטרה"
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
        }}
      >
        {renderAddOrEditForm("edit")}

      </Modal>

      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}
