// src/lib/backup.ts
import type { Timeframe } from "@/lib/types";
import { defaultCategories } from "@/lib/types";
import { loadState, saveState, type StoredState } from "@/lib/storage";
import { loadGoalsUiPrefs, saveGoalsUiPrefs, type GoalsUiPrefs } from "@/lib/uiPrefs";

export type BackupV1 = {
  app: "routineland";
  schemaVersion: 1;
  exportedAt: string; // ISO
  state: StoredState;
  uiPrefs: Partial<Record<Timeframe, GoalsUiPrefs>>;
};

const TIMEFRAMES: Timeframe[] = ["daily", "weekly", "monthly", "yearly"];

export function buildBackup(): BackupV1 {
  const state = loadState() ?? { categories: defaultCategories, goals: [] };

  const uiPrefs: Partial<Record<Timeframe, GoalsUiPrefs>> = {};
  for (const tf of TIMEFRAMES) {
    const p = loadGoalsUiPrefs(tf);
    if (p) uiPrefs[tf] = p;
  }

  return {
    app: "routineland",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    state,
    uiPrefs,
  };
}

export function backupFilename(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `routineland-backup-${y}-${m}-${d}.json`;
}

export function downloadBackup(backup: BackupV1) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename(new Date());
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function ensureState(x: unknown): StoredState {
  if (!isObject(x)) return { categories: defaultCategories, goals: [] };
  const categories = Array.isArray((x as any).categories) ? (x as any).categories : defaultCategories;
  const goals = Array.isArray((x as any).goals) ? (x as any).goals : [];
  return { categories, goals } as StoredState;
}

export function parseBackup(jsonText: string): BackupV1 {
  const raw = JSON.parse(jsonText) as unknown;
  if (!isObject(raw)) throw new Error("Bad JSON");

  if ((raw as any).app !== "routineland") throw new Error("Not a routineland backup");
  if ((raw as any).schemaVersion !== 1) throw new Error("Unsupported backup version");

  const state = ensureState((raw as any).state);

  const uiPrefs: Partial<Record<Timeframe, GoalsUiPrefs>> = {};
  const rawPrefs = (raw as any).uiPrefs;
  if (isObject(rawPrefs)) {
    for (const tf of TIMEFRAMES) {
      const p = (rawPrefs as any)[tf];
      if (p && typeof p === "object") uiPrefs[tf] = p as GoalsUiPrefs;
    }
  }

  return {
    app: "routineland",
    schemaVersion: 1,
    exportedAt: typeof (raw as any).exportedAt === "string" ? (raw as any).exportedAt : new Date().toISOString(),
    state,
    uiPrefs,
  };
}

export function restoreBackup(backup: BackupV1) {
  saveState(backup.state);

  for (const tf of TIMEFRAMES) {
    const p = backup.uiPrefs[tf];
    if (p) saveGoalsUiPrefs(tf, p);
  }
}
