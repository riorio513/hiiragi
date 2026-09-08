export const TIME_ZONE = "Asia/Tokyo";

export function yen(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("ja-JP")}円`;
}

export function dateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relative(value: Date | string | null | undefined): string {
  if (!value) return "未確認";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未確認";
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 0) return `${formatSpan(-diffSec)}後`;
  if (diffSec < 60) return "たった今";
  return `${formatSpan(diffSec)}前`;
}

export function formatSpan(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  if (sec < 3600) return `${Math.round(sec / 60)}分`;
  if (sec < 86400) return `${Math.round(sec / 3600)}時間`;
  return `${Math.round(sec / 86400)}日`;
}

/** datetime-local（日本時間として解釈）→ Date */
export function parseLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  // 日本時間（UTC+9）として読む
  const utcMs = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  ) - 9 * 60 * 60 * 1000;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → datetime-local の初期値（日本時間） */
export function toLocalInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}
