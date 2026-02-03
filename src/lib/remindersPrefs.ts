// src/lib/remindersPrefs.ts
export type RemindersPrefs = {
  enabled: boolean;
};

const KEY = "routine.reminders.v1";

export function isNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function loadRemindersPrefs(): RemindersPrefs {
  if (typeof window === "undefined") return { enabled: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw) as any;
    return { enabled: !!parsed?.enabled };
  } catch {
    return { enabled: false };
  }
}

export function saveRemindersPrefs(prefs: RemindersPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ enabled: !!prefs.enabled }));
  } catch {
    // ignore
  }
}
