"use client";

import { useEffect, useRef } from "react";
import { loadState } from "@/lib/storage";
import type { Goal } from "@/lib/types";
import { parseLocalDateTime } from "@/lib/date";
import { loadRemindersPrefs, isNotificationsSupported } from "@/lib/remindersPrefs";

const FIRED_KEY = "routine.reminders.fired.v1";

type FiredMap = Record<string, number>; // key -> timestamp

function safeReadFired(): FiredMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as FiredMap;
  } catch {
    return {};
  }
}

function safeWriteFired(map: FiredMap) {
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {}
}

function goalStartTs(g: Goal) {
  return parseLocalDateTime(g.startAt).getTime();
}

export default function ReminderEngine() {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      timeoutRef.current = null;
      intervalRef.current = null;
    };

    const canRun = () => {
      const prefs = loadRemindersPrefs();
      if (!prefs.enabled) return false;
      if (!isNotificationsSupported()) return false;
      return Notification.permission === "granted";
    };

    const fireDue = () => {
      if (!canRun()) return;

      const state = loadState();
      const goals = (state?.goals ?? []) as Goal[];

      const now = Date.now();
      const LOOKBACK_MS = 2 * 60 * 1000;

      const fired = safeReadFired();
      let wrote = false;

      for (const g of goals) {
        if (g.status === "DONE") continue;
        if (!g.startAt) continue;

        const start = goalStartTs(g);
        if (!Number.isFinite(start)) continue;

        if (start > now) continue;
        if (start < now - LOOKBACK_MS) continue;

        const key = `${g.id}:${g.startAt}`;
        if (fired[key]) continue;

        fired[key] = now;
        wrote = true;

        try {
          new Notification(`התחלה: ${g.title}`, {
            body: "המשימה מתחילה עכשיו",
            tag: key,
          });
        } catch {}
      }

      if (wrote) safeWriteFired(fired);
    };

    const scheduleNext = () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!canRun()) return;

      const state = loadState();
      const goals = (state?.goals ?? []) as Goal[];
      const now = Date.now();

      const upcoming: number[] = [];
      for (const g of goals) {
        if (g.status === "DONE") continue;
        if (!g.startAt) continue;
        const ts = goalStartTs(g);
        if (!Number.isFinite(ts)) continue;
        if (ts <= now + 2000) continue;
        upcoming.push(ts);
      }

      if (upcoming.length === 0) return;
      upcoming.sort((a, b) => a - b);

      const delay = Math.max(0, upcoming[0] - now);
      const SAFE_MAX = 2147483647;
      const actualDelay = delay > SAFE_MAX ? 60 * 60 * 1000 : delay;

      timeoutRef.current = window.setTimeout(() => {
        fireDue();
        scheduleNext();
      }, actualDelay);
    };

    fireDue();
    scheduleNext();

    intervalRef.current = window.setInterval(() => {
      fireDue();
      scheduleNext();
    }, 30 * 1000);

    return clearTimers;
  }, []);

  return null;
}
