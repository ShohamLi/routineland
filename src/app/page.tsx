// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import AnimatedBackground from "@/components/AnimatedBackground";
import Toast from "@/components/Toast";

import { loadState } from "@/lib/storage";
import { Goal, Timeframe, TIMEFRAME_LABELS } from "@/lib/types";
import { parseLocalDateTime } from "@/lib/date";
import { computeHomeStats } from "@/lib/stats";

import { buildBackup, downloadBackup, parseBackup, restoreBackup } from "@/lib/backup";
import { isNotificationsSupported, loadRemindersPrefs, saveRemindersPrefs } from "@/lib/remindersPrefs";

type Stats = { total: number; open: number; done: number };

const TIMEFRAMES: Timeframe[] = ["daily", "weekly", "monthly", "yearly"];

function getDerivedStatus(g: Goal) {
  const now = new Date();
  if (g.status === "DONE") return "DONE";
  const startAt = g.startAt ? parseLocalDateTime(g.startAt) : new Date();
  if (now < startAt) return "FUTURE";
  return "IN_PROGRESS";
}

function computeStats(goals: Goal[], tf: Timeframe): Stats {
  return goals
    .filter((g) => g.timeframe === tf)
    .reduce(
      (acc, g) => {
        acc.total++;
        getDerivedStatus(g) === "DONE" ? acc.done++ : acc.open++;
        return acc;
      },
      { total: 0, done: 0, open: 0 }
    );
}

// צבע “חתימה” לכל טווח זמן
const TF_THEME: Record<Timeframe, { accent: string; tint: string; chip: string }> = {
  daily: {
    accent: "from-sky-500 to-blue-600",
    tint: "bg-sky-500/10",
    chip: "bg-sky-500/10 text-sky-900 border-sky-500/20",
  },
  weekly: {
    accent: "from-emerald-500 to-teal-600",
    tint: "bg-emerald-500/10",
    chip: "bg-emerald-500/10 text-emerald-900 border-emerald-500/20",
  },
  monthly: {
    accent: "from-violet-500 to-fuchsia-600",
    tint: "bg-violet-500/10",
    chip: "bg-violet-500/10 text-violet-900 border-violet-500/20",
  },
  yearly: {
    accent: "from-amber-500 to-orange-600",
    tint: "bg-amber-500/10",
    chip: "bg-amber-500/10 text-amber-900 border-amber-500/20",
  },
};

type NotifPerm = "unsupported" | "default" | "granted" | "denied";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);

  // ✅ UI helpers
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ notifications prefs
  const [notifPerm, setNotifPerm] = useState<NotifPerm>("default");
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);

    const read = () => {
      const data = loadState();
      setGoals((data?.goals ?? []) as Goal[]);
    };

    // init notif state + prefs
    if (!isNotificationsSupported()) {
      setNotifPerm("unsupported");
      setRemindersEnabled(false);
    } else {
      setNotifPerm(Notification.permission as NotifPerm);
      setRemindersEnabled(loadRemindersPrefs().enabled);
    }

    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);

  const statsByTf = useMemo(() => {
    const m = new Map<Timeframe, Stats>();
    for (const tf of TIMEFRAMES) m.set(tf, computeStats(goals, tf));
    return m;
  }, [goals]);

  const totals = useMemo(() => {
    const all = goals.length;
    let done = 0;
    let open = 0;

    for (const g of goals) {
      getDerivedStatus(g) === "DONE" ? done++ : open++;
    }

    const pct = all > 0 ? Math.round((done / all) * 100) : 0;
    return { all, done, open, pct };
  }, [goals]);

  // ✅ Home stats מבוסס doneAt אמיתי (עם fallback לישן)
  const home = useMemo(() => computeHomeStats(goals), [goals]);

  // ----------------- Backup / Restore handlers -----------------

  function onBackup() {
    try {
      const backup = buildBackup();
      downloadBackup(backup);
      setToast("✅ גיבוי נשמר כקובץ JSON");
    } catch (e) {
      console.error(e);
      setToast("❌ נכשל בגיבוי");
    }
  }

  function onPickRestoreFile() {
    fileInputRef.current?.click();
  }

  async function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // מאפשר לבחור שוב אותו קובץ
    if (!file) return;

    const ok = window.confirm("שחזור ידרוס את הנתונים הנוכחיים. להמשיך?");
    if (!ok) return;

    try {
      const text = await file.text();
      const backup = parseBackup(text);
      restoreBackup(backup);
      setToast("✅ שחזור הצליח. מרענן…");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setToast("❌ קובץ גיבוי לא תקין / שחזור נכשל");
    }
  }

  // ----------------- Reminders handlers -----------------

  async function onToggleReminders() {
    if (!isNotificationsSupported()) {
      setNotifPerm("unsupported");
      setToast("בדפדפן הזה אין תמיכה בהתראות.");
      return;
    }

    const currentPerm = Notification.permission as NotifPerm;
    setNotifPerm(currentPerm);

    if (remindersEnabled) {
      saveRemindersPrefs({ enabled: false });
      setRemindersEnabled(false);
      setToast("תזכורות כובו.");
      return;
    }

    // enabling
    let perm = currentPerm;
    if (perm !== "granted") {
      perm = (await Notification.requestPermission()) as NotifPerm;
      setNotifPerm(perm);
    }

    if (perm === "granted") {
      saveRemindersPrefs({ enabled: true });
      setRemindersEnabled(true);
      setToast("✅ תזכורות הופעלו (כאשר האפליקציה פתוחה/ברקע).");
    } else if (perm === "denied") {
      saveRemindersPrefs({ enabled: false });
      setRemindersEnabled(false);
      setToast("התראות חסומות בדפדפן. צריך לאפשר בהרשאות אתר.");
    } else {
      setToast("לא אושרה הרשאת התראות.");
    }
  }

  function notifLabel() {
    if (notifPerm === "unsupported") return "אין תמיכה בהתראות";
    if (notifPerm === "denied") return "התראות חסומות";
    if (notifPerm === "granted") return "התראות מאושרות";
    return "ממתין להרשאה";
  }

  return (
    <main className="min-h-screen text-zinc-950">
      <AnimatedBackground />
      {/* שכבת כהה עדינה על הרקע כדי “להרגיע” את הבהיר */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/15" />

      {/* ✅ input נסתר לשחזור */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onRestoreFile}
      />

      <div className="mx-auto max-w-[1100px] px-6 pb-12 pt-12 md:pt-16">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[30px] border border-black/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur md:p-8">
          {/* soft blobs */}
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.35),transparent_60%)] blur-2xl" />
            <div className="absolute -right-28 -top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(167,139,250,0.30),transparent_60%)] blur-2xl" />
            <div className="absolute -bottom-40 left-[20%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.18),transparent_60%)] blur-2xl" />
          </div>

          <div className="relative grid gap-6 md:grid-cols-[1fr_520px] md:items-center">
            {/* LEFT */}
            <div className="min-w-0">
              <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">RoutineLand</h1>

              <div className="mt-2 text-base text-zinc-700 md:text-xl">
                סדר בראש · התקדמות בפועל · שקט נפשי
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `${totals.open} פתוחות` : "— פתוחות"}
                </span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `${totals.done} הושלמו` : "— הושלמו"}
                </span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `${totals.all} סה״כ` : "— סה״כ"}
                </span>
              </div>

              {/* ✅ mini stats row: streak + today + week */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `רצף: ${home.streakDays} ימים` : "רצף: —"}
                </span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `הושלמו היום: ${home.doneToday}` : "הושלמו היום: —"}
                </span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-zinc-800 shadow-sm">
                  {mounted ? `הושלמו השבוע: ${home.doneThisWeek}` : "הושלמו השבוע: —"}
                </span>
              </div>

              {/* ✅ actions row: backup/restore/reminders */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={onBackup}
                  className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm hover:bg-white"
                >
                  גבה נתונים
                </button>

                <button
                  onClick={onPickRestoreFile}
                  className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm hover:bg-white"
                >
                  שחזר מגיבוי
                </button>

                <button
                  onClick={onToggleReminders}
                  className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm hover:bg-white"
                >
                  {remindersEnabled ? "כבה תזכורות" : "הפעל תזכורות"}
                </button>

                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-zinc-700 shadow-sm">
                  {notifLabel()}
                </span>
              </div>

              {/* progress card */}
              <div className="mt-5 w-full max-w-[420px] rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm md:p-4">
                <div className="text-xs text-zinc-600">התקדמות כוללת</div>
                <div className="mt-1 text-2xl font-extrabold md:text-3xl">
                  {mounted ? `${totals.pct}%` : "—%"}
                </div>
                <div className="mt-0.5 text-xs text-zinc-600">
                  {mounted ? "מבוסס על כל הטווחים" : "טוען..."}
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full bg-black/70 transition-[width] duration-700"
                    style={{ width: mounted ? `${totals.pct}%` : "0%" }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: BIG LOGO */}
            <div className="flex justify-center md:justify-end">
              <div className="relative h-[260px] w-[260px] md:h-[360px] md:w-[360px] shrink-0">
                <Image
                  src="/image1.jpg"
                  alt="RoutineLand logo"
                  fill
                  priority
                  sizes="(min-width: 768px) 360px, 260px"
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CARDS */}
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          {TIMEFRAMES.map((tf) => {
            const s = statsByTf.get(tf) ?? { total: 0, open: 0, done: 0 };
            const theme = TF_THEME[tf];
            const pct = mounted && s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;

            return (
              <Link
                key={tf}
                href={`/goals/${tf}`}
                className={[
                  "group relative overflow-hidden rounded-2xl border border-black/10 bg-white/85 p-6 shadow-md",
                  "transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                ].join(" ")}
              >
                <div className={["absolute left-0 top-0 h-1 w-full bg-gradient-to-r", theme.accent].join(" ")} />
                <div
                  className={[
                    "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100",
                    theme.tint,
                  ].join(" ")}
                />

                <div className="relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-zinc-950">{TIMEFRAME_LABELS[tf]}</div>

                    <div className="mt-2 text-sm text-zinc-700">
                      {mounted ? `${s.open} פתוחות · ${s.done} הושלמו` : "טוען…"}
                    </div>

                    <div className="mt-3 inline-flex items-center gap-2">
                      <span
                        className={["rounded-full border px-2.5 py-1 text-xs font-medium", theme.chip].join(" ")}
                      >
                        {mounted ? `${pct}% הושלמו` : "…"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-right shadow-sm">
                    <div className="text-[11px] text-zinc-600">סה״כ</div>
                    <div className="mt-0.5 text-2xl font-extrabold text-zinc-950">
                      {mounted ? s.total : "—"}
                    </div>
                  </div>
                </div>

                <div className="relative mt-5 h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className={["h-full w-0 bg-gradient-to-r transition-[width] duration-700", theme.accent].join(" ")}
                    style={{ width: mounted ? `${pct}%` : "0%" }}
                    aria-hidden
                  />
                </div>

                <div className="relative mt-3 flex items-center justify-between text-xs text-zinc-700">
                  <span>{mounted ? `${pct}% הושלמו` : "טוען..."}</span>
                  <span className="font-semibold text-zinc-900 transition group-hover:translate-x-0.5">פתח →</span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>

      {/* ✅ Toast */}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}
