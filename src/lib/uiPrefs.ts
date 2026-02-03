import type { Timeframe } from "@/lib/types";

export type GoalsUiPrefs = {
  categoryId: string;
  categoryFilter: string;
  query: string;
};

function key(timeframe: Timeframe) {
  return `routine.ui.goals.${timeframe}.v1`;
}

export function loadGoalsUiPrefs(timeframe: Timeframe): GoalsUiPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(timeframe));
    if (!raw) return null;
    return JSON.parse(raw) as GoalsUiPrefs;
  } catch {
    return null;
  }
}

export function saveGoalsUiPrefs(timeframe: Timeframe, prefs: GoalsUiPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(timeframe), JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
