/**
 * 次にいつ確認するかを決める。
 * 販売開始が近いほど短く、エラーが続くほど長く、休止時間帯はほぼ止める。
 * 外部サイトへの負荷を避けるため、最後に必ずアダプターの最短間隔で下限を切る。
 */

export const DEFAULT_INTERVAL_SEC = 1800; // 通常時 30分
export const QUIET_INTERVAL_SEC = 10800; // 休止時間帯 3時間
export const MAX_ERROR_INTERVAL_SEC = 21600; // 6時間

export type ScheduleInput = {
  now: Date;
  /** 監視対象を見ている商品のうち、いちばん近い販売開始予定 */
  saleStartsAt: Date | null;
  consecutiveErrors: number;
  /** この監視対象を見ている全員が休止時間帯なら true */
  quiet: boolean;
  minIntervalSec: number;
};

export type ScheduleResult = { intervalSec: number; reason: string };

export function computeInterval(input: ScheduleInput): ScheduleResult {
  const { now, saleStartsAt, consecutiveErrors, quiet, minIntervalSec } = input;

  let intervalSec = DEFAULT_INTERVAL_SEC;
  let reason = "通常の監視間隔";

  if (saleStartsAt) {
    const diffSec = (saleStartsAt.getTime() - now.getTime()) / 1000;
    if (diffSec > -1800 && diffSec <= 120) {
      intervalSec = 30;
      reason = "販売開始時刻の前後";
    } else if (diffSec > 120 && diffSec <= 600) {
      intervalSec = 60;
      reason = "販売開始の直前";
    } else if (diffSec > 600 && diffSec <= 3600) {
      intervalSec = 300;
      reason = "販売開始まで1時間以内";
    } else if (diffSec > 3600 && diffSec <= 86400) {
      intervalSec = 600;
      reason = "販売開始まで24時間以内";
    }
  }

  if (quiet && intervalSec >= DEFAULT_INTERVAL_SEC) {
    intervalSec = QUIET_INTERVAL_SEC;
    reason = "監視をお休みする時間帯";
  }

  if (consecutiveErrors > 0) {
    const backoff = Math.min(
      intervalSec * Math.pow(2, Math.min(consecutiveErrors, 5)),
      MAX_ERROR_INTERVAL_SEC,
    );
    if (backoff > intervalSec) {
      intervalSec = backoff;
      reason = `エラーが${consecutiveErrors}回続いたため間隔をあけています`;
    }
  }

  const floored = Math.max(intervalSec, minIntervalSec);
  if (floored !== intervalSec) {
    reason = `${reason}（サイトへの最短間隔${minIntervalSec}秒で調整）`;
  }
  return { intervalSec: floored, reason };
}

export function nextCheckAt(input: ScheduleInput): Date {
  const { intervalSec } = computeInterval(input);
  return new Date(input.now.getTime() + intervalSec * 1000);
}

/** "22:00"〜"06:00" のように日をまたぐ指定にも対応する。 */
export function isWithinQuietHours(
  now: Date,
  timeZone: string,
  start: string,
  end: string,
): boolean {
  const minutes = minutesOfDay(now, timeZone);
  const from = parseHm(start);
  const to = parseHm(end);
  if (from === null || to === null || from === to) return false;
  if (from < to) return minutes >= from && minutes < to;
  return minutes >= from || minutes < to;
}

export function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesOfDay(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}
