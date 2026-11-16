const VN_TZ = "Asia/Ho_Chi_Minh";

export function formatVietnamDateTime(iso: string | null | undefined): string {
  if (!iso) return "Chưa xếp lịch";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Không hợp lệ";
  return date.toLocaleString("vi-VN", {
    timeZone: VN_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatVietnamDateOnly(dateOrIso: string | null | undefined): string {
  if (!dateOrIso) return "—";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso)
    ? `${dateOrIso}T00:00:00+07:00`
    : dateOrIso;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateOrIso;
  return date.toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const formatVietnamDate = formatVietnamDateOnly;

export function toVietnamDateInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Convert ISO instant into YYYY-MM-DDTHH:mm in Vietnam timezone for <input type="datetime-local">
export function toVietnamDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

export function fromVietnamDatetimeLocal(value: string): string {
  if (!value) return "";
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}+07:00`;
}

export function formatCountdownMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}
