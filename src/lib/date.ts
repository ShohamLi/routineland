// /Users/shoham/Desktop/routine/src/lib/date.ts

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatISODate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// local datetime: YYYY-MM-DDTHH:MM
export function formatISOLocalDateTime(d: Date) {
  const date = formatISODate(d);
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${date}T${hh}:${mm}`;
}

// parse local datetime (no timezone conversion)
export function parseLocalDateTime(isoLocal: string) {
  // expect "YYYY-MM-DDTHH:MM"
  const [datePart, timePart] = isoLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
